import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { DatabaseManager } from "./database-manager";
import type { Migration } from "./migration";

export interface MigratorOptions {
    readonly database: DatabaseManager;
    readonly path: string;
    readonly table?: string;
}

export interface RollbackOptions {
    /** Number of individual migrations to revert (newest first). When omitted, reverts the last batch. */
    readonly step?: number;
}

export interface RefreshOptions {
    /** When set, only roll back this many migrations before re-running; otherwise reset all. */
    readonly step?: number;
}

export interface RefreshResult {
    readonly rolledBack: string[];
    readonly migrated: string[];
}

type MigrationModule = {
    default?: new () => Migration;
};

interface MigrationRecord {
    readonly migration: string;
    readonly batch: number;
}

/**
 * Run and reverse migrations discovered in a directory (Laravel-like batch lifecycle).
 */
export class Migrator {
    private readonly database: DatabaseManager;
    private readonly path: string;
    private readonly table: string;

    constructor(options: MigratorOptions) {
        this.database = options.database;
        this.path = options.path;
        this.table = options.table ?? "migrations";
    }

    async ensureMigrationsTable(): Promise<void> {
        await this.database.connection().run(`
            CREATE TABLE IF NOT EXISTS ${this.table} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration TEXT NOT NULL UNIQUE,
                batch INTEGER NOT NULL
            )
        `);
    }

    async getRanMigrations(): Promise<Set<string>> {
        await this.ensureMigrationsTable();
        const rows = await this.database
            .connection()
            .query<{ migration: string }>(`SELECT migration FROM ${this.table}`);
        return new Set(rows.map((row) => row.migration));
    }

    async getMigrationFiles(): Promise<string[]> {
        const entries = await readdir(this.path);
        return entries
            .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
            .sort((left, right) => left.localeCompare(right));
    }

    async getPendingMigrations(): Promise<string[]> {
        const ran = await this.getRanMigrations();
        const files = await this.getMigrationFiles();
        return files.filter((file) => !ran.has(stripExtension(file)));
    }

    async getNextBatch(): Promise<number> {
        await this.ensureMigrationsTable();
        const rows = await this.database
            .connection()
            .query<{ batch: number | null }>(`SELECT MAX(batch) as batch FROM ${this.table}`);
        const current = rows[0]?.batch ?? 0;
        return current + 1;
    }

    async getLastBatchNumber(): Promise<number> {
        await this.ensureMigrationsTable();
        const rows = await this.database
            .connection()
            .query<{ batch: number | null }>(`SELECT MAX(batch) as batch FROM ${this.table}`);
        return rows[0]?.batch ?? 0;
    }

    /**
     * Resolve migration records to roll back (newest first).
     */
    async getMigrationsForRollback(options: RollbackOptions = {}): Promise<MigrationRecord[]> {
        await this.ensureMigrationsTable();
        const step = options.step ?? 0;

        if (step > 0) {
            return this.database.connection().query<MigrationRecord>(
                `SELECT migration, batch FROM ${this.table}
                 WHERE batch >= 1
                 ORDER BY batch DESC, migration DESC
                 LIMIT ?`,
                [step],
            );
        }

        const lastBatch = await this.getLastBatchNumber();
        if (lastBatch === 0) {
            return [];
        }

        return this.database.connection().query<MigrationRecord>(
            `SELECT migration, batch FROM ${this.table}
             WHERE batch = ?
             ORDER BY migration DESC`,
            [lastBatch],
        );
    }

    async run(onStep?: (migration: string) => void): Promise<string[]> {
        const pending = await this.getPendingMigrations();
        if (pending.length === 0) {
            return [];
        }

        const batch = await this.getNextBatch();
        const executed: string[] = [];
        const connection = this.database.connection();

        for (const file of pending) {
            const migrationName = stripExtension(file);
            const instance = await this.loadMigration(file);
            await instance.up(connection);
            await connection.run(`INSERT INTO ${this.table} (migration, batch) VALUES (?, ?)`, [
                migrationName,
                batch,
            ]);
            executed.push(migrationName);
            onStep?.(migrationName);
        }

        return executed;
    }

    /**
     * Roll back the last batch, or the newest `step` migrations when provided.
     */
    async rollback(options: RollbackOptions = {}, onStep?: (migration: string) => void): Promise<string[]> {
        const records = await this.getMigrationsForRollback(options);
        if (records.length === 0) {
            return [];
        }

        return this.rollbackRecords(records, onStep);
    }

    /**
     * Roll back every applied migration (newest first).
     */
    async reset(onStep?: (migration: string) => void): Promise<string[]> {
        await this.ensureMigrationsTable();
        const records = await this.database.connection().query<MigrationRecord>(
            `SELECT migration, batch FROM ${this.table}
             ORDER BY batch DESC, migration DESC`,
        );

        if (records.length === 0) {
            return [];
        }

        return this.rollbackRecords(records, onStep);
    }

    /**
     * Reset (or step-rollback) then re-run pending migrations.
     */
    async refresh(
        options: RefreshOptions = {},
        onStep?: (event: { type: "down" | "up"; migration: string }) => void,
    ): Promise<RefreshResult> {
        const step = options.step ?? 0;
        const rolledBack =
            step > 0
                ? await this.rollback({ step }, (migration) => onStep?.({ type: "down", migration }))
                : await this.reset((migration) => onStep?.({ type: "down", migration }));

        const migrated = await this.run((migration) => onStep?.({ type: "up", migration }));

        return { rolledBack, migrated };
    }

    private async rollbackRecords(
        records: readonly MigrationRecord[],
        onStep?: (migration: string) => void,
    ): Promise<string[]> {
        const filesByName = await this.getFilesByMigrationName();
        const connection = this.database.connection();
        const rolledBack: string[] = [];

        for (const record of records) {
            const file = filesByName.get(record.migration);
            if (!file) {
                throw new Error(`Migration [${record.migration}] was recorded but the file was not found.`);
            }

            const instance = await this.loadMigration(file);
            await instance.down(connection);
            await connection.run(`DELETE FROM ${this.table} WHERE migration = ?`, [record.migration]);
            rolledBack.push(record.migration);
            onStep?.(record.migration);
        }

        return rolledBack;
    }

    private async getFilesByMigrationName(): Promise<Map<string, string>> {
        const files = await this.getMigrationFiles();
        const map = new Map<string, string>();
        for (const file of files) {
            map.set(stripExtension(file), file);
        }
        return map;
    }

    private async loadMigration(file: string): Promise<Migration> {
        const module = (await import(pathToFileURL(join(this.path, file)).href)) as MigrationModule;
        const MigrationClass = module.default;

        if (!MigrationClass) {
            throw new Error(`Migration [${file}] must export a default class implementing Migration.`);
        }

        return new MigrationClass();
    }
}

function stripExtension(file: string): string {
    return file.replace(/\.(ts|js)$/, "");
}
