import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";

class User extends Model {
    protected static table = "users";

    // Relation Definition (Eloquent style)
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

describe("Relations", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        const conn = db.connection();
        await conn.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
        await conn.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT)");
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("hasMany relationship", async () => {
        const user = new User({ name: "Alice" });
        await user.save(); // id 1

        const post1 = new Post({ title: "Post 1", user_id: user.id });
        await post1.save();
        const post2 = new Post({ title: "Post 2", user_id: user.id });
        await post2.save();

        // user.posts() returns Relation object (which extends QueryBuilder)
        // user.posts().get() returns Collection<Post>
        const posts = await user.posts().get();
        expect(posts.count()).toBe(2);
        expect(posts.first().title).toBe("Post 1");
    });

    test("belongsTo relationship", async () => {
        const user = new User({ name: "Bob" });
        await user.save(); // id 2 presumably since new DB each time? No, fresh DB per beforeEach. id 1.

        const post = new Post({ title: "Bob Post", user_id: user.id });
        await post.save();

        const fetchedUser = await post.user().first(); // returns Model|null
        expect(fetchedUser).not.toBeNull();
        expect(fetchedUser.id).toBe(user.id);
        expect(fetchedUser.name).toBe("Bob");
    });
});
