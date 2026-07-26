/**
 * Database connection management with Bun native drivers.
 *
 * Provides unified interface for SQLite, PostgreSQL, and MySQL using
 * Bun's native database drivers with automatic connection pooling.
 *
 * @packageDocumentation
 */

import { Database } from "bun:sqlite";
import { SQL } from "bun";
import type { Connector } from "./query-builder";
import type { ConnectionConfig, DatabaseDriver, WhereClauseValue } from "./types";

/**
 * Result of an INSERT/UPDATE/DELETE statement execution.
 */
export interface StatementResult {
    readonly lastInsertId: number | string | null;
    readonly changes: number;
}

/**
 * Database connection type - varies by driver.
 */
export type DatabaseConnection = Database | SQL;

/**
 * Transaction callback type with proper typing.
 */
export type TransactionCallback<T> = (tx: Connection) => Promise<T>;

/**
 * The Connection class handles database connections using Bun's native drivers.
 *
 * Features:
 * - Automatic connection pooling for PostgreSQL/MySQL
 * - Native prepared statements with SQL injection protection
 * - Transaction management with automatic rollback
 * - BigInt type safety configuration
 *
 * @example
 * ```typescript
 * const conn = new Connection({
 *     driver: 'postgres',
 *     url: 'postgres://user:pass@localhost:5432/mydb',
 *     max: 10, // Pool size
 *     bigint: 'string', // Handle BigInt as strings
 * });
 *
 * const users = await conn.query('SELECT * FROM users WHERE age > ?', [18]);
 * await conn.close();
 * ```
 */
export class Connection implements Connector {
    /**
     * Raw database connection (Database for SQLite, SQL for Postgres/MySQL).
     */
    protected readonly db: DatabaseConnection;

    /**
     * Connection configuration.
     */
    protected readonly config: Readonly<ConnectionConfig>;

    /**
     * Normalized database driver name.
     */
    protected readonly driver: DatabaseDriver;

    /**
     * Create a new Connection instance.
     *
     * @param config - Connection configuration
     * @throws Error if driver is not supported
     */
    constructor(config: ConnectionConfig) {
        this.config = Object.freeze({ ...config });
        // Normalizes 'postgresql' to 'postgres'
        const driverName = config.driver === "postgresql" ? "postgres" : config.driver;
        this.driver = driverName as DatabaseDriver;
        this.db = this.connect();
    }

    /**
     * Serialize binding values for database compatibility.
     *
     * Converts Date objects to ISO strings since Bun SQL expects
     * primitive types for bindings.
     *
     * @param bindings - Raw binding values
     * @returns Serialized bindings safe for database queries
     */
    private serializeBindings(bindings: readonly WhereClauseValue[]): (string | number | boolean | null)[] {
        return bindings.map((value: WhereClauseValue): string | number | boolean | null => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        });
    }

    /**
     * Establish the database connection.
     *
     * @returns Database connection instance
     * @throws Error if driver is not supported or connection fails
     */
    protected connect(): DatabaseConnection {
        switch (this.driver) {
            case "sqlite": {
                const filename = this.config.url || this.config.filename || ":memory:";
                return new Database(filename);
            }
            case "postgres":
            case "postgresql":
            case "mysql": {
                if (!this.config.url) {
                    throw new Error(`URL is required for ${this.driver} driver`);
                }

                // Use Bun SQL native with connection pooling
                // Type assertion needed due to incomplete Bun SQL type definitions
                return new SQL(this.config.url, {
                    connectionTimeout: this.config.connectionTimeout ?? 10_000,
                    idleTimeout: this.config.idleTimeout ?? 30_000,
                    max: this.config.max ?? 10,
                } as Record<string, unknown>);
            }
            default: {
                const exhaustiveCheck: never = this.driver;
                throw new Error(`Driver [${exhaustiveCheck}] not supported.`);
            }
        }
    }

    /**
     * Execute a SQL query and return the results.
     *
     * Uses Bun's prepared statements for SQL injection protection.
     *
     * @template T - The type of rows returned
     * @param sql - SQL query string
     * @param bindings - Query parameter bindings
     * @returns Array of result rows
     *
     * @example
     * ```typescript
     * const users = await conn.query<User>(
     *     'SELECT * FROM users WHERE age > ? AND status = ?',
     *     [18, 'active']
     * );
     * ```
     */
    async query<T = unknown>(sql: string, bindings: readonly WhereClauseValue[] = []): Promise<T[]> {
        const serialized = this.serializeBindings(bindings);

        switch (this.driver) {
            case "sqlite": {
                const db = this.db as Database;
                const query = db.query<T, (string | number | boolean | null)[]>(sql);
                return query.all(...serialized);
            }
            case "postgres":
            case "postgresql":
            case "mysql": {
                const db = this.db as SQL;
                // Bun SQL unsafe() method accepts SQL string with bindings
                const result = await db.unsafe(sql, serialized);
                return Array.from(result) as T[];
            }
            default: {
                const exhaustiveCheck: never = this.driver;
                throw new Error(`Query not supported for driver [${exhaustiveCheck}]`);
            }
        }
    }

    /**
     * Execute a statement (INSERT/UPDATE/DELETE) and return result info.
     *
     * @param sql - SQL statement
     * @param bindings - Query parameter bindings
     * @returns Statement execution result
     *
     * @example
     * ```typescript
     * const result = await conn.run(
     *     'INSERT INTO users (name, email) VALUES (?, ?)',
     *     ['Alice', 'alice@example.com']
     * );
     * console.log(`Inserted ID: ${result.lastInsertId}`);
     * ```
     */
    async run(sql: string, bindings: readonly WhereClauseValue[] = []): Promise<StatementResult> {
        const serialized = this.serializeBindings(bindings);

        switch (this.driver) {
            case "sqlite": {
                const db = this.db as Database;
                const query = db.query(sql);
                const result = query.run(...serialized);

                // Type guard for lastInsertRowid - can be number or bigint
                const lastId = result.lastInsertRowid;
                const insertId: number | string | null =
                    typeof lastId === "bigint" ? lastId.toString() : typeof lastId === "number" ? lastId : null;

                return {
                    changes: result.changes,
                    lastInsertId: insertId,
                };
            }
            case "postgres":
            case "postgresql":
            case "mysql": {
                const db = this.db as SQL;
                const result = await db.unsafe(sql, serialized);

                // PostgreSQL RETURNING clause returns the id directly
                // MySQL uses insertId from result metadata
                const resultArray = Array.from(result);
                const firstRow = resultArray[0] as Record<string, unknown> | undefined;

                // Type guard for id field
                const idValue = firstRow?.id;
                const insertId: number | string | null =
                    typeof idValue === "bigint"
                        ? idValue.toString()
                        : typeof idValue === "number"
                          ? idValue
                          : typeof idValue === "string"
                            ? idValue
                            : ((result as unknown as { insertId?: number }).insertId ?? null);

                return {
                    changes:
                        (result as unknown as { count?: number; affectedRows?: number }).count ??
                        (result as unknown as { affectedRows?: number }).affectedRows ??
                        0,
                    lastInsertId: insertId,
                };
            }
            default: {
                const exhaustiveCheck: never = this.driver;
                throw new Error(`Statement execution not supported for driver [${exhaustiveCheck}]`);
            }
        }
    }

    /**
     * Close the database connection.
     *
     * @returns Promise that resolves when connection is closed
     */
    async close(): Promise<void> {
        if (!this.db) {
            return;
        }

        switch (this.driver) {
            case "sqlite": {
                (this.db as Database).close();
                break;
            }
            case "postgres":
            case "postgresql":
            case "mysql": {
                await (this.db as SQL).close();
                break;
            }
            default: {
                const exhaustiveCheck: never = this.driver;
                throw new Error(`Close not supported for driver [${exhaustiveCheck}]`);
            }
        }
    }

    /**
     * Execute a transaction using Bun SQL's native begin() method.
     *
     * Transactions automatically rollback on error. For PostgreSQL/MySQL,
     * uses Bun's native transaction management. For SQLite, uses manual
     * BEGIN/COMMIT/ROLLBACK.
     *
     * @template T - The type returned by the transaction callback
     * @param callback - Callback to execute within transaction context
     * @returns Result from callback
     * @throws Error from callback (after rollback)
     *
     * @example
     * ```typescript
     * await conn.begin(async (tx) => {
     *     await tx.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
     *     await tx.run('UPDATE accounts SET balance = balance - ?', [100]);
     * });
     * ```
     */
    async begin<T>(callback: TransactionCallback<T>): Promise<T> {
        switch (this.driver) {
            case "sqlite": {
                const db = this.db as Database;
                // SQLite: use manual BEGIN/COMMIT/ROLLBACK
                db.run("BEGIN TRANSACTION");
                try {
                    const result = await callback(this);
                    db.run("COMMIT");
                    return result;
                } catch (error) {
                    db.run("ROLLBACK");
                    throw error;
                }
            }
            case "postgres":
            case "postgresql":
            case "mysql": {
                const db = this.db as SQL;
                // Bun SQL: use native begin() method with auto-rollback
                return await db.begin(async (tx) => {
                    // Wrap the Bun SQL transaction in a Connection-like interface
                    const txConnection = new TransactionConnection(tx, this.driver, this.config);
                    return callback(txConnection);
                });
            }
            default: {
                const exhaustiveCheck: never = this.driver;
                throw new Error(`Transactions not supported for driver [${exhaustiveCheck}]`);
            }
        }
    }

    /**
     * Get the raw database connection for advanced operations.
     *
     * @returns Raw Database (SQLite) or SQL (Postgres/MySQL) instance
     *
     * @example
     * ```typescript
     * const rawDb = conn.getRawConnection();
     * if (rawDb instanceof Database) {
     *     // SQLite-specific operations
     * }
     * ```
     */
    getRawConnection(): DatabaseConnection {
        return this.db;
    }
}

/**
 * Internal class for wrapping Bun SQL transactions.
 *
 * Provides Connection-compatible interface for use within transaction callbacks.
 */
class TransactionConnection extends Connection {
    private readonly txDb: SQL;

    constructor(tx: SQL, _driver: DatabaseDriver, config: Readonly<ConnectionConfig>) {
        // Don't call connect() - we already have the transaction connection
        super(config);
        this.txDb = tx;
        // Override the db property with the transaction connection
        (this as unknown as { db: SQL }).db = tx;
    }

    protected override connect(): DatabaseConnection {
        // Override to prevent re-connection during transaction
        return this.txDb;
    }
}
