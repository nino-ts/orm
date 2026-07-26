import { beforeEach, describe, expect, test } from "bun:test";
import { QueryBuilder } from "../../src/query-builder";

// Mock connector since we only care about the SQL generated
const mockConnector = {
    getRawConnection: () => null,
    query: async () => [],
    run: async () => ({ changes: 1, lastInsertId: 1 }),
};

describe("QueryBuilder Conditional Helpers", () => {
    let builder: QueryBuilder<unknown>;

    beforeEach(() => {
        builder = new QueryBuilder<unknown>(mockConnector as unknown as import("../../src/query-builder").Connector);
        builder.from("users");
    });

    test("when() applies callback if condition is truthy", () => {
        builder.when("search", (q, val) => q.where("name", "=", val));

        expect(builder.toSql()).toBe("SELECT * FROM users WHERE name = ?");
        expect(builder.getBindings()).toEqual(["search"]);
    });

    test("when() ignores callback if condition is falsy", () => {
        builder.when(false, (q) => q.where("name", "=", "ignore"));

        expect(builder.toSql()).toBe("SELECT * FROM users");
        expect(builder.getBindings()).toEqual([]);
    });

    test("when() applies fallback if condition is falsy", () => {
        builder.when(
            null,
            (q) => q.where("role", "=", "admin"),
            (q) => q.where("role", "=", "user"),
        );

        expect(builder.toSql()).toBe("SELECT * FROM users WHERE role = ?");
        expect(builder.getBindings()).toEqual(["user"]);
    });

    test("unless() applies callback if condition is falsy", () => {
        builder.unless(false, (q) => q.where("active", "=", 1));

        expect(builder.toSql()).toBe("SELECT * FROM users WHERE active = ?");
        expect(builder.getBindings()).toEqual([1]);
    });

    test("unless() ignores callback if condition is truthy", () => {
        builder.unless(true, (q) => q.where("active", "=", 0));

        expect(builder.toSql()).toBe("SELECT * FROM users");
        expect(builder.getBindings()).toEqual([]);
    });
});
