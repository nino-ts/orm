import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import process from "node:process";
import { DatabaseManager } from "../../src/database-manager";

/**
 * Integration tests for PostgreSQL and MySQL drivers.
 * Requires docker-compose running: bun run test:db
 */
describe("Database Drivers", () => {
    const skipIfNoDocker = process.env.POSTGRES_URL ? describe : describe.skip;

    skipIfNoDocker("PostgreSQL Driver", () => {
        let db: DatabaseManager;

        beforeAll(() => {
            db = new DatabaseManager();
            db.addConnection("postgres", {
                driver: "postgres",
                url: process.env.POSTGRES_URL || "postgres://ninots:ninots@localhost:5432/ninots_test",
            });
        });

        afterAll(async () => {
            await db.closeALl();
        });

        test("should connect and run simple query", async () => {
            const conn = db.connection("postgres");
            const result = await conn.query("SELECT 1 as num");
            expect(result[0].num).toBe(1);
        });

        test("should create table and insert data", async () => {
            const conn = db.connection("postgres");

            await conn.run("DROP TABLE IF EXISTS test_users");
            await conn.run(`
                CREATE TABLE test_users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255),
                    email VARCHAR(255)
                )
            `);

            const insertResult = await conn.run("INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING id", [
                "John",
                "john@test.com",
            ]);

            expect(insertResult.lastInsertId).toBeDefined();
        });

        test("should support transactions", async () => {
            const conn = db.connection("postgres");

            // Use Bun SQL's native begin() for transactions
            try {
                await conn.begin(async (tx) => {
                    await tx`INSERT INTO test_users (name, email) VALUES (${"Alice"}, ${"alice@test.com"})`;
                    // Throw to trigger rollback
                    throw new Error("Rollback test");
                });
            } catch (_e) {
                // Expected error from rollback
            }

            const result = await conn.query("SELECT * FROM test_users WHERE email = $1", ["alice@test.com"]);
            expect(result.length).toBe(0);
        });
    });

    skipIfNoDocker("MySQL/MariaDB Driver", () => {
        let db: DatabaseManager;

        beforeAll(() => {
            db = new DatabaseManager();
            db.addConnection("mysql", {
                driver: "mysql",
                url: process.env.MYSQL_URL || "mysql://ninots:ninots@localhost:3306/ninots_test",
            });
        });

        afterAll(async () => {
            await db.closeALl();
        });

        test("should connect and run simple query", async () => {
            const conn = db.connection("mysql");
            const result = await conn.query("SELECT 1 as num");
            expect(result[0].num).toBe(1);
        });

        test("should create table and insert data", async () => {
            const conn = db.connection("mysql");

            await conn.run("DROP TABLE IF EXISTS test_users");
            await conn.run(`
                CREATE TABLE test_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255),
                    email VARCHAR(255)
                )
            `);

            const insertResult = await conn.run("INSERT INTO test_users (name, email) VALUES (?, ?)", [
                "John",
                "john@test.com",
            ]);

            expect(insertResult.lastInsertId).toBeDefined();
        });
    });
});
