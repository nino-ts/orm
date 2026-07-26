import { describe, expect, test } from "bun:test";
import { Model } from "../../src/model";

interface UserAttributes {
    id: number;
    name: string;
    email: string;
    password?: string;
}

class User extends Model<UserAttributes> {
    protected static table = "users";
    protected static hidden = ["password"];
}

describe("Model State & Serialization", () => {
    test("isDirty and isClean track changes", () => {
        const user = new User({ email: "john@test.com", id: 1, name: "John" });

        // Initially not dirty (hydration simulates this if syncOriginal is called)
        user.syncOriginal();

        expect(user.isDirty()).toBe(false);
        expect(user.isClean()).toBe(true);

        user.setAttribute("name", "Jane");

        expect(user.isDirty()).toBe(true);
        expect(user.isDirty("name")).toBe(true);
        expect(user.isDirty("email")).toBe(false);

        expect(user.isClean("name")).toBe(false);
        expect(user.isClean("email")).toBe(true);

        expect(user.getDirty()).toEqual({ name: "Jane" });
    });

    test("toArray respects hidden properties", () => {
        const user = new User({
            email: "john@test.com",
            id: 1,
            name: "John",
            password: "secret_password",
        });

        const serialized = user.toArray();

        expect(serialized).toHaveProperty("name", "John");
        expect(serialized).toHaveProperty("email", "john@test.com");
        expect(serialized).not.toHaveProperty("password");
    });

    test("toArray respects visible properties over hidden", () => {
        class StrictUser extends Model<UserAttributes> {
            protected static table = "users";
            protected static visible = ["name"];
            protected static hidden = ["name", "password"]; // Contradiction, visible wins
        }

        const user = new StrictUser({
            email: "john@test.com",
            id: 1,
            name: "John",
            password: "secret_password",
        });

        const serialized = user.toArray();

        expect(serialized).toHaveProperty("name", "John");
        expect(serialized).not.toHaveProperty("email");
        expect(serialized).not.toHaveProperty("password");
        expect(Object.keys(serialized)).toHaveLength(1);
    });

    test("toJSON outputs correct string representation", () => {
        const user = new User({
            email: "john@test.com",
            id: 1,
            name: "John",
            password: "secret_password",
        });

        const json = user.toJSON();
        const parsed = JSON.parse(json);

        expect(parsed.name).toBe("John");
        expect(parsed.password).toBeUndefined();
    });
});
