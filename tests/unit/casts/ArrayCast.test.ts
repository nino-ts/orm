/**
 * Array and JSON Cast Tests.
 *
 * Tests for the ArrayCast and JsonCast classes.
 */

import { describe, expect, test } from "bun:test";
import { ArrayCast, JsonCast } from "../../../src/casts/array-cast";

describe("ArrayCast", () => {
    describe("getType()", () => {
        test("should return array type", () => {
            const caster = new ArrayCast();
            expect(caster.getType()).toBe("array");
        });
    });

    describe("get()", () => {
        test("should parse JSON array string to array", () => {
            const caster = new ArrayCast();
            const result = caster.get('["a", "b", "c"]');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(["a", "b", "c"]);
        });

        test("should return array unchanged", () => {
            const caster = new ArrayCast();
            const input = [1, 2, 3];
            const result = caster.get(input);

            expect(result).toBe(input);
        });

        test("should convert object to array of entries", () => {
            const caster = new ArrayCast();
            const result = caster.get('{"key": "value"}');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([["key", "value"]]);
        });

        test("should convert null to empty array", () => {
            const caster = new ArrayCast();
            const result = caster.get(null);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([]);
        });

        test("should convert undefined to empty array", () => {
            const caster = new ArrayCast();
            const result = caster.get(undefined);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([]);
        });

        test("should convert single value to array", () => {
            const caster = new ArrayCast();
            const result = caster.get("single");

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(["single"]);
        });

        test("should convert number to array", () => {
            const caster = new ArrayCast();
            const result = caster.get(42);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([42]);
        });

        test("should handle invalid JSON string", () => {
            const caster = new ArrayCast();
            const result = caster.get("not-json");

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(["not-json"]);
        });

        test("should convert object value to array of values", () => {
            const caster = new ArrayCast();
            const result = caster.get({ a: 1, b: 2 });

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([1, 2]);
        });
    });

    describe("set()", () => {
        test("should convert array to JSON string", () => {
            const caster = new ArrayCast();
            const result = caster.set([1, 2, 3]);

            expect(typeof result).toBe("string");
            expect(JSON.parse(result)).toEqual([1, 2, 3]);
        });

        test("should convert null to empty array JSON", () => {
            const caster = new ArrayCast();
            const result = caster.set(null);

            expect(result).toBe("[]");
        });

        test("should convert undefined to empty array JSON", () => {
            const caster = new ArrayCast();
            const result = caster.set(undefined);

            expect(result).toBe("[]");
        });

        test("should convert single value to array JSON", () => {
            const caster = new ArrayCast();
            const result = caster.set("value");

            expect(JSON.parse(result)).toEqual(["value"]);
        });
    });
});

describe("JsonCast", () => {
    describe("getType()", () => {
        test("should return json type", () => {
            const caster = new JsonCast();
            expect(caster.getType()).toBe("json");
        });
    });

    describe("get()", () => {
        test("should parse JSON object string", () => {
            const caster = new JsonCast();
            const result = caster.get('{"name": "John", "age": 30}');

            expect(typeof result).toBe("object");
            expect(result).toEqual({ age: 30, name: "John" });
        });

        test("should parse JSON array string", () => {
            const caster = new JsonCast();
            const result = caster.get("[1, 2, 3]");

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([1, 2, 3]);
        });

        test("should return object unchanged", () => {
            const caster = new JsonCast();
            const input = { name: "John" };
            const result = caster.get(input);

            expect(result).toBe(input);
        });

        test("should return null for null value", () => {
            const caster = new JsonCast();
            expect(caster.get(null)).toBe(null);
        });

        test("should return null for undefined value", () => {
            const caster = new JsonCast();
            expect(caster.get(undefined)).toBe(null);
        });

        test("should handle invalid JSON string", () => {
            const caster = new JsonCast();
            const result = caster.get("not-json");

            expect(result).toBe("not-json");
        });

        test("should return primitive values unchanged", () => {
            const caster = new JsonCast();
            expect(caster.get(42)).toBe(42);
            expect(caster.get("string")).toBe("string");
            expect(caster.get(true)).toBe(true);
        });
    });

    describe("set()", () => {
        test("should convert object to JSON string", () => {
            const caster = new JsonCast();
            const result = caster.set({ age: 30, name: "John" });

            expect(typeof result).toBe("string");
            expect(JSON.parse(result)).toEqual({ age: 30, name: "John" });
        });

        test("should convert array to JSON string", () => {
            const caster = new JsonCast();
            const result = caster.set([1, 2, 3]);

            expect(typeof result).toBe("string");
            expect(JSON.parse(result)).toEqual([1, 2, 3]);
        });

        test('should convert null to "null" string', () => {
            const caster = new JsonCast();
            const result = caster.set(null);

            expect(result).toBe("null");
        });

        test('should convert undefined to "null" string', () => {
            const caster = new JsonCast();
            const result = caster.set(undefined);

            expect(result).toBe("null");
        });

        test("should convert primitive to JSON string", () => {
            const caster = new JsonCast();
            expect(caster.set(42)).toBe("42");
            expect(caster.set("string")).toBe('"string"');
            expect(caster.set(true)).toBe("true");
        });
    });
});
