import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Connection } from "../../src/connection";
import { DatabaseManager } from "../../src/database-manager";

describe("DatabaseManager", () => {
    let db: DatabaseManager;

    beforeEach(() => {
        db = new DatabaseManager();
        // Clear global settings if they exist (mock or reset singleton if applicable)
    });

    afterEach(async () => {
        // Close connections
        await db.closeALl();
    });

    test("should add and retrieve connection", () => {
        db.addConnection("default", {
            driver: "sqlite",
            url: ":memory:",
        });

        const conn = db.connection("default");
        expect(conn).toBeDefined();
        expect(conn).toBeInstanceOf(Connection);
    });

    test("should throw error if connection not found", () => {
        expect(() => {
            db.connection("non_existent");
        }).toThrow("Database connection [non_existent] not configured.");
    });

    test("should use default connection if name not provided", () => {
        db.addConnection("main", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("main");

        const conn = db.connection();
        expect(conn).toBeDefined();
        // We could verify the connection name if exposed
    });

    test("should support multiple connections", () => {
        db.addConnection("sqlite1", { driver: "sqlite", url: ":memory:" });
        db.addConnection("sqlite2", { driver: "sqlite", url: ":memory:" });

        expect(db.connection("sqlite1")).not.toBe(db.connection("sqlite2"));
    });

    test("should return default connection name", () => {
        expect(db.getDefaultConnection()).toBe("default");
    });

    test("setDefaultConnection should change the default", () => {
        db.setDefaultConnection("primary");
        expect(db.getDefaultConnection()).toBe("primary");
    });

    test("should cache connection instances", () => {
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        const conn1 = db.connection("default");
        const conn2 = db.connection("default");
        expect(conn1).toBe(conn2);
    });

    test("closeAll should clear connections", async () => {
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.connection("default"); // create the connection
        await db.closeALl();
        // After closing, a new connection() call should create a fresh one
        const fresh = db.connection("default");
        expect(fresh).toBeDefined();
    });
});
