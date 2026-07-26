import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";
import { Transaction, transaction } from "../../src/transaction";

class _Account extends Model {
    protected static override table = "accounts";
}

describe("Transaction", () => {
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

        const conn = db.connection();
        await conn.run("CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, balance INTEGER)");
        await conn.run("INSERT INTO accounts (name, balance) VALUES (?, ?)", ["Alice", 1000]);
        await conn.run("INSERT INTO accounts (name, balance) VALUES (?, ?)", ["Bob", 500]);
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("transaction should commit changes", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);

        await conn.run("UPDATE accounts SET balance = balance - 100 WHERE name = ?", ["Alice"]);
        await conn.run("UPDATE accounts SET balance = balance + 100 WHERE name = ?", ["Bob"]);

        await tx.commit();

        const alice = await conn.query<{ balance: number }>("SELECT balance FROM accounts WHERE name = ?", ["Alice"]);
        const bob = await conn.query<{ balance: number }>("SELECT balance FROM accounts WHERE name = ?", ["Bob"]);

        expect(alice[0].balance).toBe(900);
        expect(bob[0].balance).toBe(600);
    });

    test("transaction should rollback changes", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);

        await conn.run("UPDATE accounts SET balance = balance - 100 WHERE name = ?", ["Alice"]);

        await tx.rollback();

        const alice = await conn.query<{ balance: number }>("SELECT balance FROM accounts WHERE name = ?", ["Alice"]);
        expect(alice[0].balance).toBe(1000);
    });

    test("transaction should auto-rollback on dispose if not committed", async () => {
        const conn = db.connection();

        {
            const tx = await Transaction.begin(conn);
            await conn.run("UPDATE accounts SET balance = balance - 100 WHERE name = ?", ["Alice"]);
            await tx[Symbol.asyncDispose]();
        }

        const alice = await conn.query<{ balance: number }>("SELECT balance FROM accounts WHERE name = ?", ["Alice"]);
        expect(alice[0].balance).toBe(1000);
    });

    test("Transaction.execute should auto-commit on success", async () => {
        const conn = db.connection();
        const result = await Transaction.execute(conn, async (tx) => {
            await tx.run("UPDATE accounts SET balance = balance - 200 WHERE name = ?", ["Alice"]);
            return "done";
        });

        expect(result.committed).toBe(true);
        expect(result.result).toBe("done");

        const alice = await conn.query<{ balance: number }>("SELECT balance FROM accounts WHERE name = ?", ["Alice"]);
        expect(alice[0].balance).toBe(800);
    });

    test("Transaction.execute should re-throw non-retryable errors", async () => {
        const conn = db.connection();
        await expect(
            Transaction.execute(conn, async () => {
                throw new Error("something broke");
            }),
        ).rejects.toThrow("something broke");
    });

    test("transaction() helper function should work", async () => {
        const conn = db.connection();
        const result = await transaction(conn, async (tx) => {
            await tx.run("UPDATE accounts SET balance = balance + 50 WHERE name = ?", ["Bob"]);
            const bob = await tx.query<{ balance: number }>("SELECT balance FROM accounts WHERE name = ?", ["Bob"]);
            return bob[0].balance;
        });

        expect(result).toBe(550);
    });

    test("query() should delegate to connection", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);

        const rows = await tx.query<{ name: string }>("SELECT name FROM accounts ORDER BY id");
        expect(rows.length).toBe(2);
        expect(rows[0].name).toBe("Alice");

        await tx.commit();
    });

    test("run() should delegate to connection", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);

        const result = await tx.run("INSERT INTO accounts (name, balance) VALUES (?, ?)", ["Charlie", 300]);
        expect(result.changes).toBe(1);

        await tx.commit();
    });

    test("state getters should reflect transaction lifecycle", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);

        expect(tx.isActive).toBe(true);
        expect(tx.isCommitted).toBe(false);
        expect(tx.isRolledBack).toBe(false);
        expect(tx.currentState).toBe("active");

        await tx.commit();

        expect(tx.isActive).toBe(false);
        expect(tx.isCommitted).toBe(true);
        expect(tx.isRolledBack).toBe(false);
        expect(tx.currentState).toBe("committed");
    });

    test("state getters after rollback", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);
        await tx.rollback();

        expect(tx.isActive).toBe(false);
        expect(tx.isCommitted).toBe(false);
        expect(tx.isRolledBack).toBe(true);
        expect(tx.currentState).toBe("rolled_back");
    });

    test("query() should throw on non-active transaction", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);
        await tx.commit();

        await expect(tx.query("SELECT 1")).rejects.toThrow("Transaction is committed, cannot execute queries");
    });

    test("run() should throw on non-active transaction", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);
        await tx.rollback();

        await expect(tx.run("SELECT 1")).rejects.toThrow("Transaction is rolled_back, cannot execute queries");
    });

    test("commit on already committed should be no-op", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);
        await tx.commit();
        // Should not throw
        await tx.commit();
        expect(tx.isCommitted).toBe(true);
    });

    test("rollback on already committed should be no-op", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);
        await tx.commit();
        // Should not throw
        await tx.rollback();
        expect(tx.isCommitted).toBe(true);
    });

    test("savepoint/rollbackTo/releaseSavepoint should execute SQL", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);

        await tx.savepoint("sp1");
        await tx.run("UPDATE accounts SET balance = 0 WHERE name = ?", ["Alice"]);
        await tx.rollbackTo("sp1");

        const alice = await tx.query<{ balance: number }>("SELECT balance FROM accounts WHERE name = ?", ["Alice"]);
        expect(alice[0].balance).toBe(1000);

        await tx.savepoint("sp2");
        await tx.run("UPDATE accounts SET balance = 999 WHERE name = ?", ["Bob"]);
        await tx.releaseSavepoint("sp2");

        const bob = await tx.query<{ balance: number }>("SELECT balance FROM accounts WHERE name = ?", ["Bob"]);
        expect(bob[0].balance).toBe(999);

        await tx.commit();
    });

    test("asyncDispose should be no-op if already committed", async () => {
        const conn = db.connection();
        const tx = await Transaction.begin(conn);
        await tx.run("UPDATE accounts SET balance = 0 WHERE name = ?", ["Alice"]);
        await tx.commit();
        await tx[Symbol.asyncDispose](); // Should not throw or rollback

        const alice = await conn.query<{ balance: number }>("SELECT balance FROM accounts WHERE name = ?", ["Alice"]);
        expect(alice[0].balance).toBe(0);
    });
});
