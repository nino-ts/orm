import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseManager } from "../../src/database-manager";
import { Factory, configureModelFactory } from "../../src/factory/factory";
import { Model } from "../../src/model";
import { Migrator } from "../../src/migrator";
import { fake } from "../../src/support/faker";

class User extends Model {
    protected static override table = "users";
    protected static override fillable = ["name", "email", "password"];
}

class UserFactory extends Factory<User, { name: string; email: string; password: string }> {
    definition() {
        return {
            email: fake.uniqueEmail(),
            name: fake.name(),
            password: fake.password(),
        };
    }

    model() {
        return User;
    }

    unverified() {
        return this.state({ email: `unverified-${fake.randomString(6)}@ninots.test` });
    }
}

configureModelFactory(User, UserFactory);

describe("Factory", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", {
            database: ":memory:",
            driver: "sqlite",
            url: ":memory:",
        });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        await db.connection().run(
            "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, password TEXT)",
        );
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("create() persists a single model with inferred attributes", async () => {
        const user = await UserFactory.new().create();

        expect(user.id).toBeDefined();
        expect(user.name).toBeString();
        expect(user.email).toContain("@");
    });

    test("count() returns a typed array of models", async () => {
        const users = await User.factory(3).create();

        expect(users).toHaveLength(3);
        expect(users[0]?.id).toBeDefined();
    });

    test("state() overrides generated attributes", async () => {
        const user = await UserFactory.new()
            .state({ name: "Nova" })
            .create({ email: "nova@ninots.test" });

        expect(user.name).toBe("Nova");
        expect(user.email).toBe("nova@ninots.test");
    });

    test("custom state method composes with definition()", async () => {
        const user = await UserFactory.new().unverified().create();

        expect(user.email).toContain("unverified-");
    });

    test("make() builds without persisting", async () => {
        const user = await UserFactory.new().make({ name: "Ghost" });

        expect(user.name).toBe("Ghost");
        expect(user.exists).toBeFalsy();
    });
});

describe("Migrator", () => {
    let db: DatabaseManager;
    let migrationsPath = "";

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", {
            database: ":memory:",
            driver: "sqlite",
            url: ":memory:",
        });
        db.setDefaultConnection("default");

        migrationsPath = await mkdtemp(join(tmpdir(), "ninots-migrations-"));
    });

    afterEach(async () => {
        await db.closeALl();
        await rm(migrationsPath, { force: true, recursive: true });
    });

    test("run() executes pending migrations in filename order", async () => {
        await writeFile(
            join(migrationsPath, "2024_01_01_create_users_table.ts"),
            `export default class CreateUsersTable {
                async up(connection) {
                    await connection.run("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)");
                }
                async down(connection) {
                    await connection.run("DROP TABLE users");
                }
            }`,
        );

        await writeFile(
            join(migrationsPath, "2024_01_02_create_posts_table.ts"),
            `export default class CreatePostsTable {
                async up(connection) {
                    await connection.run("CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)");
                }
                async down(connection) {
                    await connection.run("DROP TABLE posts");
                }
            }`,
        );

        const migrator = new Migrator({ database: db, path: migrationsPath });
        const executed = await migrator.run();

        expect(executed).toEqual(["2024_01_01_create_users_table", "2024_01_02_create_posts_table"]);

        const tables = await db
            .connection()
            .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
        const names = tables.map((table) => table.name);

        expect(names).toContain("users");
        expect(names).toContain("posts");
        expect(names).toContain("migrations");
    });

    test("run() skips already executed migrations", async () => {
        await writeFile(
            join(migrationsPath, "2024_01_01_create_users_table.ts"),
            `export default class CreateUsersTable {
                async up(connection) {
                    await connection.run("CREATE TABLE users (id INTEGER PRIMARY KEY)");
                }
                async down() {}
            }`,
        );

        const migrator = new Migrator({ database: db, path: migrationsPath });
        const firstRun = await migrator.run();
        const secondRun = await migrator.run();

        expect(firstRun).toHaveLength(1);
        expect(secondRun).toHaveLength(0);
    });

    test("rollback() reverts the last batch only", async () => {
        await writeFile(
            join(migrationsPath, "2024_01_01_create_users_table.ts"),
            `export default class CreateUsersTable {
                async up(connection) {
                    await connection.run("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)");
                }
                async down(connection) {
                    await connection.run("DROP TABLE users");
                }
            }`,
        );
        await writeFile(
            join(migrationsPath, "2024_01_02_create_posts_table.ts"),
            `export default class CreatePostsTable {
                async up(connection) {
                    await connection.run("CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)");
                }
                async down(connection) {
                    await connection.run("DROP TABLE posts");
                }
            }`,
        );

        const migrator = new Migrator({ database: db, path: migrationsPath });
        await migrator.run();

        await writeFile(
            join(migrationsPath, "2024_01_03_create_tags_table.ts"),
            `export default class CreateTagsTable {
                async up(connection) {
                    await connection.run("CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT)");
                }
                async down(connection) {
                    await connection.run("DROP TABLE tags");
                }
            }`,
        );

        await migrator.run();
        expect(await migrator.getLastBatchNumber()).toBe(2);

        const rolledBack = await migrator.rollback();
        expect(rolledBack).toEqual(["2024_01_03_create_tags_table"]);

        const tables = await db
            .connection()
            .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
        const names = tables.map((table) => table.name);

        expect(names).toContain("users");
        expect(names).toContain("posts");
        expect(names).not.toContain("tags");
        expect(await migrator.getLastBatchNumber()).toBe(1);
    });

    test("rollback({ step }) reverts the newest N migrations across batches", async () => {
        await writeFile(
            join(migrationsPath, "2024_01_01_create_users_table.ts"),
            `export default class CreateUsersTable {
                async up(connection) {
                    await connection.run("CREATE TABLE users (id INTEGER PRIMARY KEY)");
                }
                async down(connection) {
                    await connection.run("DROP TABLE users");
                }
            }`,
        );
        await writeFile(
            join(migrationsPath, "2024_01_02_create_posts_table.ts"),
            `export default class CreatePostsTable {
                async up(connection) {
                    await connection.run("CREATE TABLE posts (id INTEGER PRIMARY KEY)");
                }
                async down(connection) {
                    await connection.run("DROP TABLE posts");
                }
            }`,
        );

        const migrator = new Migrator({ database: db, path: migrationsPath });
        await migrator.run();

        const rolledBack = await migrator.rollback({ step: 1 });
        expect(rolledBack).toEqual(["2024_01_02_create_posts_table"]);

        const tables = await db
            .connection()
            .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
        const names = tables.map((table) => table.name);
        expect(names).toContain("users");
        expect(names).not.toContain("posts");
    });

    test("refresh() resets schema then re-runs migrations", async () => {
        await writeFile(
            join(migrationsPath, "2024_01_01_create_users_table.ts"),
            `export default class CreateUsersTable {
                async up(connection) {
                    await connection.run("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)");
                }
                async down(connection) {
                    await connection.run("DROP TABLE users");
                }
            }`,
        );

        const migrator = new Migrator({ database: db, path: migrationsPath });
        await migrator.run();
        await db.connection().run("INSERT INTO users (email) VALUES ('stale@ninots.test')");

        const result = await migrator.refresh();
        expect(result.rolledBack).toEqual(["2024_01_01_create_users_table"]);
        expect(result.migrated).toEqual(["2024_01_01_create_users_table"]);

        const rows = await db.connection().query<{ email: string }>("SELECT email FROM users");
        expect(rows).toHaveLength(0);
        expect(await migrator.getLastBatchNumber()).toBe(1);
    });

    test("rollback() returns empty when nothing has run", async () => {
        const migrator = new Migrator({ database: db, path: migrationsPath });
        const rolledBack = await migrator.rollback();
        expect(rolledBack).toEqual([]);
    });
});
