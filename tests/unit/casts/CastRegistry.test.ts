/**
 * Cast Registry Tests.
 *
 * Tests for the CastRegistry class and attribute casting system.
 */

import { describe, expect, test } from "bun:test";
import { BooleanCast } from "../../../src/casts/boolean-cast";
import { CastRegistry, globalCastRegistry } from "../../../src/casts/cast-registry";

describe("CastRegistry", () => {
    describe("constructor()", () => {
        test("should create a new registry instance", () => {
            const registry = new CastRegistry();
            expect(registry).toBeInstanceOf(CastRegistry);
        });
    });

    describe("register()", () => {
        test("should register a caster for a specific type", () => {
            const registry = new CastRegistry();
            const caster = new BooleanCast();

            registry.register("boolean", caster);

            expect(registry.has("boolean")).toBe(true);
        });

        test("should allow registering multiple casters", () => {
            const registry = new CastRegistry();
            const caster1 = new BooleanCast();
            const caster2 = new BooleanCast();

            registry.register("boolean", caster1);
            registry.register("array", caster2);

            expect(registry.has("boolean")).toBe(true);
            expect(registry.has("array")).toBe(true);
        });

        test("should overwrite existing caster for same type", () => {
            const registry = new CastRegistry();
            const caster1 = new BooleanCast();
            const caster2 = new BooleanCast();

            registry.register("boolean", caster1);
            registry.register("boolean", caster2);

            expect(registry.get("boolean")).toBe(caster2);
        });
    });

    describe("get()", () => {
        test("should return registered caster", () => {
            const registry = new CastRegistry();
            const caster = new BooleanCast();

            registry.register("boolean", caster);

            expect(registry.get("boolean")).toBe(caster);
        });

        test("should throw error when caster not found", () => {
            const registry = new CastRegistry();

            expect(() => registry.get("nonexistent" as "boolean")).toThrow(
                "Caster not registered for type: nonexistent",
            );
        });
    });

    describe("has()", () => {
        test("should return true for registered caster", () => {
            const registry = new CastRegistry();
            const caster = new BooleanCast();

            registry.register("boolean", caster);

            expect(registry.has("boolean")).toBe(true);
        });

        test("should return false for unregistered caster", () => {
            const registry = new CastRegistry();

            expect(registry.has("boolean")).toBe(false);
        });
    });

    describe("getTypes()", () => {
        test("should return array of registered types", () => {
            const registry = new CastRegistry();

            registry.register("boolean", new BooleanCast());
            registry.register("array", new BooleanCast());

            const types = registry.getTypes();

            expect(types).toContain("boolean");
            expect(types).toContain("array");
            expect(types.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe("remove()", () => {
        test("should remove caster by type", () => {
            const registry = new CastRegistry();
            const caster = new BooleanCast();

            registry.register("boolean", caster);
            expect(registry.has("boolean")).toBe(true);

            registry.remove("boolean");

            expect(registry.has("boolean")).toBe(false);
        });
    });

    describe("clear()", () => {
        test("should remove all casters", () => {
            const registry = new CastRegistry();

            registry.register("boolean", new BooleanCast());
            registry.register("array", new BooleanCast());

            registry.clear();

            expect(registry.getTypes().length).toBe(0);
        });
    });
});

describe("globalCastRegistry", () => {
    test("should be a singleton instance", () => {
        expect(globalCastRegistry).toBeInstanceOf(CastRegistry);
        expect(globalCastRegistry).toBe(globalCastRegistry);
    });
});
