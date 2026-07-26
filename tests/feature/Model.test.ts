import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";
import type { WhereClauseValue } from "../../src/types";

class User extends Model {
    protected static override table = "users";
    protected static override fillable = ["name", "email"];
}

describe("Model", () => {
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

        // Create table for tests
        const conn = db.connection();
        await conn.run(
            "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, created_at TEXT, updated_at TEXT)",
        );
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("should have default table name based on class name", () => {
        class BlogPost extends Model {}
        expect(BlogPost.getTable()).toBe("blog_posts");
    });

    test("should use custom table name", () => {
        expect(User.getTable()).toBe("users");
    });

    test("should create new instance with attributes", () => {
        const user = new User({ name: "John" });
        expect(user.getAttribute("name")).toBe("John");
        expect(user.name).toBe("John"); // Proxy access
    });

    test("save() should insert record", async () => {
        const user = new User({ email: "john@example.com", name: "John" });
        await user.save();

        expect(user.id).toBeDefined();

        const stored = await db.connection().query("SELECT * FROM users WHERE id = ?", [user.id as WhereClauseValue]);
        expect((stored[0] as Record<string, unknown>).name).toBe("John");
    });

    test("find() should return a model by primary key", async () => {
        const user = new User({ email: "find@example.com", name: "Find Me" });
        await user.save();

        const found = await User.find(user.id as number);

        expect(found).toBeDefined();
        expect(found?.id).toBe(user.id);
        expect(found?.getAttribute("email")).toBe("find@example.com");
    });

    test("create() should persist and return instance", async () => {
        const created = await User.create({
            email: "jane@example.com",
            name: "Jane",
        });

        expect(created.id).toBeDefined();

        const stored = await db
            .connection()
            .query("SELECT * FROM users WHERE id = ?", [created.id as WhereClauseValue]);
        expect((stored[0] as Record<string, unknown>).email).toBe("jane@example.com");
    });

    test("firstOrCreate() should return existing model", async () => {
        const existing = new User({
            email: "existing@example.com",
            name: "Existing",
        });
        await existing.save();

        const result = await User.firstOrCreate({ email: "existing@example.com" }, { name: "Ignored" });

        expect(result.id).toBe(existing.id);
        expect(result.getAttribute("name")).toBe("Existing");
    });

    test("firstOrCreate() should create when missing", async () => {
        const result = await User.firstOrCreate({ email: "new@example.com" }, { name: "New" });

        expect(result.id).toBeDefined();
        expect(result.getAttribute("name")).toBe("New");
    });

    test("save() should respect non-incrementing string keys", async () => {
        class ApiKey extends Model {
            protected static override table = "api_keys";
            protected static override incrementing = false;
            protected static override keyType: "string" | "int" = "string";
        }

        await db.connection().run("CREATE TABLE api_keys (id TEXT PRIMARY KEY, name TEXT)");

        const apiKey = new ApiKey({ id: "key_123", name: "Primary" });
        await apiKey.save();

        expect(apiKey.id).toBe("key_123");

        const stored = await db
            .connection()
            .query("SELECT * FROM api_keys WHERE id = ?", [apiKey.id as WhereClauseValue]);
        expect((stored[0] as Record<string, unknown>).id).toBe("key_123");
    });
});
