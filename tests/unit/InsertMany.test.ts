import { describe, expect, test } from "bun:test";
import { QueryBuilder } from "../../src/query-builder";

describe("QueryBuilder Bulk Insert", () => {
    test("insertMany generates correct bulk SQL and bindings", async () => {
        let capturedSql = "";
        let capturedBindings: unknown[] = [];

        const mockConnector = {
            getRawConnection: () => null,
            query: async () => [],
            run: async (sql: string, bindings: unknown[]) => {
                capturedSql = sql;
                capturedBindings = bindings;
                return { changes: 2, lastInsertId: 1 };
            },
        };

        const builder = new QueryBuilder<unknown>(mockConnector as unknown as import("../../src/query-builder").Connector);
        builder.from("users");

        await builder.insertMany([
            { age: 30, name: "John" },
            { age: 25, name: "Jane" },
        ]);

        // Check if SQL string correctly formats multiple rows
        expect(capturedSql).toBe("INSERT INTO users (age, name) VALUES (?, ?), (?, ?)");

        // Check if bindings were flattened correctly
        expect(capturedBindings).toEqual([30, "John", 25, "Jane"]);
    });

    test("insertMany throws on empty array", async () => {
        const mockConnector = {
            getRawConnection: () => null,
            query: async () => [],
            run: async () => ({ changes: 0, lastInsertId: 1 }),
        };

        const builder = new QueryBuilder<unknown>(mockConnector as unknown as import("../../src/query-builder").Connector);
        builder.from("users");

        expect(builder.insertMany([])).rejects.toThrow("Cannot insert empty values array");
    });
});
