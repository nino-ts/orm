import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";

class User extends Model {
    protected static table = "users";

    posts() {
        return this.hasMany(Post, "user_id", "id");
    }
}

class Post extends Model {
    protected static table = "posts";

    user() {
        return this.belongsTo(User, "user_id", "id");
    }
}

describe("Eager Loading", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        const conn = db.connection();
        await conn.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
        await conn.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT)");

        // Seed data
        await conn.run("INSERT INTO users (name) VALUES (?)", ["Alice"]);
        await conn.run("INSERT INTO users (name) VALUES (?)", ["Bob"]);
        await conn.run("INSERT INTO posts (user_id, title) VALUES (?, ?)", [1, "Alice Post 1"]);
        await conn.run("INSERT INTO posts (user_id, title) VALUES (?, ?)", [1, "Alice Post 2"]);
        await conn.run("INSERT INTO posts (user_id, title) VALUES (?, ?)", [2, "Bob Post 1"]);
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("with() should eager load hasMany relationship", async () => {
        const users = await User.with("posts").get();

        expect(users.count()).toBe(2);

        const alice = users.first();
        expect(alice.posts).toBeDefined();
        expect(alice.posts.count()).toBe(2);
        expect(alice.posts.first().title).toBe("Alice Post 1");
    });

    test("with() should eager load belongsTo relationship", async () => {
        const posts = await Post.with("user").get();

        expect(posts.count()).toBe(3);

        const alicePost = posts.first();
        expect(alicePost.user).toBeDefined();
        expect(alicePost.user.name).toBe("Alice");
    });

    test("with() should support multiple relations", async () => {
        // User with posts, Post with user - nested loading
        const users = await User.with("posts").get();

        expect(users.first().posts).toBeDefined();
    });

    test("load() should lazy eager load on collection", async () => {
        const users = await User.all();

        // Posts not loaded yet (relation storage is empty)
        expect(users.first()?.getRelation("posts")).toBeUndefined();

        // Lazy load
        await users.load("posts");

        expect(users.first()?.getRelation("posts")).toBeDefined();
        expect(users.first()?.posts.count()).toBe(2);
    });
});
