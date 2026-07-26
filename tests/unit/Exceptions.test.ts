import { describe, expect, test } from "bun:test";
import {
    MassAssignmentException,
    ModelNotFoundException,
    QueryException,
    RelationNotFoundException,
} from "../../src/exceptions";

describe("ORM Exceptions", () => {
    describe("ModelNotFoundException", () => {
        test("should format message with model name and ids", () => {
            const error = new ModelNotFoundException("User", [1, 2]);
            expect(error.message).toBe("No query results for model [User] with ids [1,2].");
            expect(error.name).toBe("ModelNotFoundException");
            expect(error).toBeInstanceOf(Error);
        });

        test("should format message without ids", () => {
            const error = new ModelNotFoundException("User");
            expect(error.message).toBe("No query results for model [User] .");
        });

        test("should format message with empty ids array", () => {
            const error = new ModelNotFoundException("Post", []);
            expect(error.message).toBe("No query results for model [Post] .");
        });
    });

    describe("QueryException", () => {
        test("should include sql and bindings", () => {
            const error = new QueryException("Syntax error", "SELECT * FROM users WHERE id = ?", [42]);
            expect(error.message).toBe("Syntax error");
            expect(error.sql).toBe("SELECT * FROM users WHERE id = ?");
            expect(error.bindings).toEqual([42]);
            expect(error.name).toBe("QueryException");
            expect(error).toBeInstanceOf(Error);
        });

        test("should handle empty bindings", () => {
            const error = new QueryException("Table not found", "SELECT * FROM missing", []);
            expect(error.bindings).toEqual([]);
        });
    });

    describe("RelationNotFoundException", () => {
        test("should format message with model and relation", () => {
            const error = new RelationNotFoundException("User", "posts");
            expect(error.message).toBe("Relation [posts] not found on model [User].");
            expect(error.name).toBe("RelationNotFoundException");
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe("MassAssignmentException", () => {
        test("should format message with model and keys", () => {
            const error = new MassAssignmentException("User", ["password", "role"]);
            expect(error.message).toBe("Add [password, role] to fillable property to allow mass assignment on [User].");
            expect(error.name).toBe("MassAssignmentException");
            expect(error).toBeInstanceOf(Error);
        });

        test("should handle single key", () => {
            const error = new MassAssignmentException("Post", ["admin"]);
            expect(error.message).toContain("[admin]");
        });
    });
});
