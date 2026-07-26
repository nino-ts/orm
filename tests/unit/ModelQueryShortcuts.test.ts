import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { DatabaseManager } from "../../src/database-manager";
import { Model, ModelNotFoundException } from "../../src/model";
import type { QueryBuilder } from "../../src/query-builder";

interface UserAttributes {
    id: number;
    email: string;
    name: string;
}

class User extends Model<UserAttributes> {
    protected static table = "users";
}

describe("Model Query Shortcuts", () => {
    let mockQueryBuilder: unknown;
    let mockDatabaseManager: unknown;

    beforeEach(() => {
        // Reset the mock
        mockQueryBuilder = {
            first: mock().mockResolvedValue(null),
            from: mock().mockReturnThis(),
            insert: mock().mockResolvedValue({ lastInsertId: 1 }),
            setModel: mock().mockReturnThis(),
            update: mock().mockResolvedValue({ changes: 1 }),
            where: mock().mockReturnThis(),
        };

        mockDatabaseManager = {
            connection: () => ({
                query: mock().mockResolvedValue([]),
                run: mock().mockResolvedValue({ changes: 1, lastInsertId: 1 }),
            }),
        };

        Model.setConnectionResolver(mockDatabaseManager as unknown as DatabaseManager);

        // Override newQuery for the User model to return our mock
        User.prototype.newQuery = () => mockQueryBuilder as unknown as QueryBuilder<unknown>;
    });

    test("findOrFail throws ModelNotFoundException when record is missing", async () => {
        mockQueryBuilder.first.mockResolvedValueOnce(null);

        expect(User.findOrFail(999)).rejects.toThrow(ModelNotFoundException);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith("id", 999);
    });

    test("findOrFail returns instance when record exists", async () => {
        const existingUser = new User({ id: 1, name: "John" });
        mockQueryBuilder.first.mockResolvedValueOnce(existingUser);

        const result = await User.findOrFail(1);

        expect(result).toBe(existingUser);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith("id", 1);
    });

    test("firstOrNew returns existing record if found without saving", async () => {
        const existingUser = new User({
            email: "test@test.com",
            id: 1,
            name: "Old Name",
        });
        mockQueryBuilder.first.mockResolvedValueOnce(existingUser);

        const result = await User.firstOrNew({ email: "test@test.com" }, { name: "New Name" });

        expect(result).toBe(existingUser);
        expect(result.getAttribute("name")).toBe("Old Name"); // Didn't apply new values
        expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    test("firstOrNew returns new non-persisted instance if not found", async () => {
        mockQueryBuilder.first.mockResolvedValueOnce(null);

        const result = await User.firstOrNew({ email: "test@test.com" }, { name: "New Name" });

        expect(result).toBeInstanceOf(User);
        expect(result.getAttribute("email")).toBe("test@test.com");
        expect(result.getAttribute("name")).toBe("New Name");
        expect(result.exists).toBe(false); // Not persisted
        expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    test("updateOrCreate updates existing record if found", async () => {
        const existingUser = new User({
            email: "test@test.com",
            id: 1,
            name: "Old Name",
        });
        existingUser.exists = true; // Mark as existing so save() triggers update
        mockQueryBuilder.first.mockResolvedValueOnce(existingUser);

        const result = await User.updateOrCreate({ email: "test@test.com" }, { name: "New Name" });

        expect(result).toBe(existingUser);
        expect(result.getAttribute("name")).toBe("New Name"); // Applied new values
        expect(mockQueryBuilder.update).toHaveBeenCalled();
    });

    test("updateOrCreate creates new record if not found", async () => {
        mockQueryBuilder.first.mockResolvedValueOnce(null);

        const result = await User.updateOrCreate({ email: "test@test.com" }, { name: "New Name" });

        expect(result).toBeInstanceOf(User);
        expect(result.getAttribute("email")).toBe("test@test.com");
        expect(result.getAttribute("name")).toBe("New Name");
        expect(result.exists).toBe(true); // Persisted
        expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });
});
