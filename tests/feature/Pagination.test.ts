import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";

class Post extends Model {
    protected static override table = "posts";
}

describe("Pagination", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        const conn = db.connection();
        await conn.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)");

        // Insert 25 posts
        for (let i = 1; i <= 25; i++) {
            await conn.run("INSERT INTO posts (title) VALUES (?)", [`Post ${i}`]);
        }
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("paginate should return correct page data", async () => {
        const result = await Post.query().paginate(10, 1);

        expect(result.data.count()).toBe(10);
        expect(result.currentPage).toBe(1);
        expect(result.perPage).toBe(10);
        expect(result.total).toBe(25);
        expect(result.lastPage).toBe(3);
    });

    test("paginate should return correct second page", async () => {
        const result = await Post.query().paginate(10, 2);

        expect(result.data.count()).toBe(10);
        expect(result.currentPage).toBe(2);
        expect(result.data.first().title).toBe("Post 11");
    });

    test("paginate should return partial last page", async () => {
        const result = await Post.query().paginate(10, 3);

        expect(result.data.count()).toBe(5);
        expect(result.currentPage).toBe(3);
    });

    test("chunk should process items in batches", async () => {
        let batches = 0;
        let totalItems = 0;

        await Post.query().chunk(10, (items) => {
            batches++;
            totalItems += items.count();
        });

        expect(batches).toBe(3);
        expect(totalItems).toBe(25);
    });
});
