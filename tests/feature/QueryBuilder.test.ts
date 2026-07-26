import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Collection } from "../../src/collection";
import { QueryBuilder } from "../../src/query-builder";

describe("QueryBuilder", () => {
    // Mock Connection
    const mockConnection = {
        query: mock((_sql: string, _bindings: unknown[]) => Promise.resolve([])),
        run: mock((_sql: string, _bindings: unknown[]) => Promise.resolve({ changes: 1, lastInsertId: 1 })),
    };

    beforeEach(() => {
        mockConnection.query.mockClear();
        mockConnection.run.mockClear();
    });

    test("should build SELECT * query by default", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users");
        expect(qb.toSql()).toBe("SELECT * FROM users");
    });

    test("should build SELECT with specific columns", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).select("id", "name").from("users");
        expect(qb.toSql()).toBe("SELECT id, name FROM users");
    });

    // Where Clause
    test("should add WHERE clause with = operator", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users").where("id", "=", 1);
        expect(qb.toSql()).toBe("SELECT * FROM users WHERE id = ?");
        expect(qb.getBindings()).toEqual([1]);
    });

    test("should add WHERE clause with implicit =", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users").where("active", true);
        expect(qb.toSql()).toBe("SELECT * FROM users WHERE active = ?");
        expect(qb.getBindings()).toEqual([true]);
    });

    test("whereIn with empty array should compile to 0 = 1", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users").whereIn("id", []);
        expect(qb.toSql()).toBe("SELECT * FROM users WHERE 0 = 1");
        expect(qb.getBindings()).toEqual([]);
    });

    test("whereNotIn with empty array should compile to 1 = 1", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users").whereNotIn("id", []);
        expect(qb.toSql()).toBe("SELECT * FROM users WHERE 1 = 1");
        expect(qb.getBindings()).toEqual([]);
    });
    test("should chain multiple WHERE clauses with AND", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection)
            .from("users")
            .where("status", "=", "active")
            .where("age", ">", 18);
        expect(qb.toSql()).toBe("SELECT * FROM users WHERE status = ? AND age > ?");
    });

    test("orWhere should add OR condition", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection)
            .from("users")
            .where("id", 1)
            .orWhere("id", 2);
        expect(qb.toSql()).toBe("SELECT * FROM users WHERE id = ? OR id = ?");
    });

    test("whereNull should add IS NULL condition", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users").whereNull("deleted_at");
        expect(qb.toSql()).toBe("SELECT * FROM users WHERE deleted_at IS NULL");
    });

    test("whereIn should add IN condition", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users").whereIn("id", [1, 2, 3]);
        expect(qb.toSql()).toBe("SELECT * FROM users WHERE id IN (?, ?, ?)");
        expect(qb.getBindings()).toEqual([1, 2, 3]);
    });

    // Limit & Offset & Order
    test("should add LIMIT and OFFSET", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users").limit(10).offset(5);
        expect(qb.toSql()).toBe("SELECT * FROM users LIMIT 10 OFFSET 5");
    });

    test("should add ORDER BY", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection)
            .from("users")
            .orderBy("created_at", "desc");
        expect(qb.toSql()).toBe("SELECT * FROM users ORDER BY created_at DESC");
    });

    // Joins
    test("join should add JOIN clause", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection)
            .from("users")
            .join("posts", "users.id", "=", "posts.user_id");
        expect(qb.toSql()).toBe("SELECT * FROM users INNER JOIN posts ON users.id = posts.user_id");
    });

    test("leftJoin should add LEFT JOIN clause", () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection)
            .from("users")
            .leftJoin("posts", "users.id", "=", "posts.user_id");
        expect(qb.toSql()).toBe("SELECT * FROM users LEFT JOIN posts ON users.id = posts.user_id");
    });

    // Execution
    test("get() should execute query and return collection", async () => {
        const result = [{ id: 1, name: "John" }];
        mockConnection.query.mockResolvedValue(result as never); // Cast to satisfy inferred mock return type

        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users");
        const collection = await qb.get();

        expect(mockConnection.query).toHaveBeenCalledWith("SELECT * FROM users", []);
        expect(collection).toBeInstanceOf(Collection);
        expect(collection.first()).toEqual(result[0]);
    });

    test("insert() should execute insert query", async () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users");
        await qb.insert({ email: "john@test.com", name: "John" });

        expect(mockConnection.run).toHaveBeenCalledTimes(1);
        // Validar SQL simplificado
        const lastCall = mockConnection.run.mock.calls[0];
        expect(lastCall[0]).toContain("INSERT INTO users");
        expect(lastCall[1]).toEqual(["john@test.com", "John"]);
    });

    test("update() should execute update query", async () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users").where("id", 1);
        await qb.update({ name: "Jane" });

        expect(mockConnection.run).toHaveBeenCalledTimes(1);
        expect(mockConnection.run).toHaveBeenCalledWith("UPDATE users SET name = ? WHERE id = ?", ["Jane", 1]);
    });

    test("delete() should execute delete query", async () => {
        const qb = new QueryBuilder(mockConnection as unknown as Connection).from("users").where("id", 1);
        await qb.delete();

        expect(mockConnection.run).toHaveBeenCalledTimes(1);
        expect(mockConnection.run).toHaveBeenCalledWith("DELETE FROM users WHERE id = ?", [1]);
    });
});
