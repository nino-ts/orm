import { Database } from "bun:sqlite";
import { afterAll, beforeAll, beforeEach, mock } from "bun:test";

// In-memory SQLite connection for tests using native bun:sqlite
// Note: Bun.SQL does not expose 'SQL' directly instantiable for :memory: like the native sqlite driver
// We will use bun:sqlite for isolated unit tests where we need a fast in-memory DB
let testDb: Database;

beforeAll(() => {
    testDb = new Database(":memory:");
    testDb.run(
        "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT)",
    );
    testDb.run(
        "CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, content TEXT, created_at TEXT, updated_at TEXT)",
    );
});

afterAll(() => {
    testDb.close();
});

beforeEach(() => {
    mock.restore();
    // Clear tables
    testDb.run("DELETE FROM users");
    testDb.run("DELETE FROM posts");
    // Reset autoincrement
    testDb.run('DELETE FROM sqlite_sequence WHERE name="users" OR name="posts"');
});

export { testDb };
