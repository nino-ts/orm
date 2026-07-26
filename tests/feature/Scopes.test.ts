import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HasScopes } from "../../src/concerns/has-scopes";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";
import type { QueryBuilder } from "../../src/query-builder";

class User extends HasScopes(Model) {
    protected static override table = "users";

    // Local scope: scopeActive -> User.active()
    static scopeActive(query: QueryBuilder) {
        return query.where("active", "=", true);
    }

    // Local scope with parameter
    static scopeOlderThan(query: QueryBuilder, age: number) {
        return query.where("age", ">", age);
    }
}

describe("Local Scopes", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        const conn = db.connection();
        await conn.run(
            "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, active INTEGER, age INTEGER)",
        );
        await conn.run("INSERT INTO users (name, active, age) VALUES (?, ?, ?)", ["Alice", 1, 25]);
        await conn.run("INSERT INTO users (name, active, age) VALUES (?, ?, ?)", ["Bob", 0, 30]);
        await conn.run("INSERT INTO users (name, active, age) VALUES (?, ?, ?)", ["Charlie", 1, 35]);
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("should apply local scope without parameters", async () => {
        const activeUsers = await User.scope("active").get();

        expect(activeUsers.count()).toBe(2);
        expect(activeUsers.pluck("name")).toContain("Alice");
        expect(activeUsers.pluck("name")).toContain("Charlie");
    });

    test("should apply local scope with parameters", async () => {
        const olderUsers = await User.scope("olderThan", 28).get();

        expect(olderUsers.count()).toBe(2);
        expect(olderUsers.pluck("name")).toContain("Bob");
        expect(olderUsers.pluck("name")).toContain("Charlie");
    });

    test("should chain scopes with where", async () => {
        const activeOlderUsers = await User.scope("active").where("age", ">", 30).get();

        expect(activeOlderUsers.count()).toBe(1);
        expect(activeOlderUsers.first().name).toBe("Charlie");
    });
});
