import { describe, expect, test } from "bun:test";

import type { ModelCreateInput, ModelUpdateInput } from "../../src/types";

interface UserAttributes {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    created_at: Date;
    updated_at: Date;
}

describe("Model Types (Compile-time logic)", () => {
    test("ModelCreateInput should exclude auto-generated fields", () => {
        type CreateIncludesId = "id" extends keyof ModelCreateInput<UserAttributes> ? true : false;
        const idIsExcluded: CreateIncludesId = false;

        const validCreate: ModelCreateInput<UserAttributes> = {
            email: "john@example.com",
            is_admin: false,
            name: "John",
        };

        expect(idIsExcluded).toBe(false);
        expect(validCreate).toHaveProperty("name");
    });

    test("ModelUpdateInput should make all remaining fields optional", () => {
        type UpdateIncludesId = "id" extends keyof ModelUpdateInput<UserAttributes> ? true : false;
        const idIsExcluded: UpdateIncludesId = false;

        const validUpdate: ModelUpdateInput<UserAttributes> = {
            name: "John Doe",
            // email is omitted, which is valid for an update
        };

        expect(idIsExcluded).toBe(false);
        expect(validUpdate).toHaveProperty("name");
    });
});
