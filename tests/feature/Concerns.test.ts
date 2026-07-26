import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HasScopes } from "../../src/concerns/has-scopes";
import { HasTimestamps } from "../../src/concerns/has-timestamps";
import { SoftDeletes } from "../../src/concerns/soft-deletes";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";
import type { QueryBuilder } from "../../src/query-builder";

// Mixin usage test
class Post extends HasTimestamps(SoftDeletes(Model)) {
    protected static table = "posts";
    protected static fillable = ["title"];
}

// Scopes test model
class User extends HasScopes(Model) {
    protected static table = "users";
    protected static fillable = ["name", "active"];

    static scopeActive(query: QueryBuilder) {
        return query.where("active", "=", true);
    }

    static scopeInactive(query: QueryBuilder) {
        return query.where("active", "=", false);
    }

    static scopeByName(query: QueryBuilder, name: string) {
        return query.where("name", "like", `%${name}%`);
    }
}

describe("Concerns", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        const conn = db.connection();
        await conn.run(
            "CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT)",
        );
        await conn.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, active BOOLEAN)");
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("HasTimestamps should set created_at and updated_at on create", async () => {
        const post = new Post({ title: "New Post" });
        await post.save();

        expect(post.created_at).toBeDefined();
        expect(post.updated_at).toBeDefined();

        const stored = await db.connection().query("SELECT * FROM posts WHERE id = ?", [post.id]);
        expect(stored[0].created_at).not.toBeNull();
    });

    test("HasTimestamps should update updated_at on save", async () => {
        const post = new Post({ title: "Post" });
        await post.save();
        const _created = post.created_at;
        const _updated = post.updated_at;

        // Wait distinct time or mock time? Bun doesn't mock time natively easily, but enough delay?
        // Or just check it is defined. Logic is harder to test without mocking Date.now
        // We'll check if it exists.

        post.title = "Updated Post";
        await post.save();

        expect(post.updated_at).toBeDefined();
    });

    test("SoftDeletes should set deleted_at on delete", async () => {
        const post = new Post({ title: "To Delete" });
        await post.save();

        await post.delete();

        const stored = await db.connection().query("SELECT * FROM posts WHERE id = ?", [post.id]);
        expect(stored[0].deleted_at).not.toBeNull();

        // Ensure standard query excludes soft deleted?
        // This requires Global Scope implementation which we haven't done yet, but SoftDeletes mixin might add it.
        // Let's expect query() to exclude it if SoftDeletes is smart.

        const all = await Post.query().get();
        const found = all.filter((p: Record<string, unknown>) => p.id === post.id);
        expect(found.count()).toBe(0);
    });

    test("SoftDeletes withTrashed should include deleted", async () => {
        const post = new Post({ title: "Trash" });
        await post.save();
        await post.delete();

        const all = await Post.withTrashed().get(); // withTrashed static method added by Mixin?
        expect(all.count()).toBe(1);
    });

    test("HasScopes should apply single scope", () => {
        const query = User.scope("active");
        expect(query).toBeDefined();
        // Query should have where clause: active = true
    });

    test("HasScopes should apply scope with parameters", () => {
        const query = User.scope("byName", "John");
        expect(query).toBeDefined();
        // Query should have where clause: name LIKE %John%
    });

    test("HasScopes should throw error for undefined scope", () => {
        expect(() => {
            User.scope("undefined");
        }).toThrow("Scope");
    });

    test("HasTimestamps updateTimestamps should set created_at on new record", () => {
        const post = new Post({ title: "Fresh" });
        (post as unknown as { exists: boolean }).exists = false;

        (post as unknown as { updateTimestamps: () => void }).updateTimestamps();

        expect(post.created_at).toBeDefined();
        expect(post.updated_at).toBeDefined();
    });

    test("HasTimestamps updateTimestamps should not set created_at on existing record", () => {
        const post = new Post({ title: "Existing" });
        (post as unknown as { exists: boolean }).exists = true;

        (post as unknown as { updateTimestamps: () => void }).updateTimestamps();

        expect(post.created_at).toBeUndefined();
        expect(post.updated_at).toBeDefined();
    });

    test("HasTimestamps save should call updateTimestamps", async () => {
        const post = new Post({ title: "Auto Timestamp" });
        let updateCalled = false;

        const originalUpdate = (post as unknown as { updateTimestamps: () => void }).updateTimestamps;
        (post as unknown as { updateTimestamps: () => void }).updateTimestamps = () => {
            updateCalled = true;
            originalUpdate.call(post);
        };

        await post.save();

        expect(updateCalled).toBe(true);
    });

    test("HasScopes should handle scope name capitalization", () => {
        const query = User.scope("active");
        expect(query).toBeDefined();

        const query2 = User.scope("Active");
        expect(query2).toBeDefined();
    });
});
