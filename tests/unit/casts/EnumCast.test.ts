/**
 * Enum Cast Tests.
 *
 * Tests for the EnumCast class.
 */

import { describe, expect, test } from "bun:test";
import { EnumCast } from "../../../src/casts/enum-cast";

// Test enums
enum StringStatus {
    Active = "active",
    Inactive = "inactive",
    Pending = "pending",
}

enum NumberStatus {
    Active = 1,
    Inactive = 0,
    Pending = 2,
}

export enum MixedEnum {
    Active = "active",
    Inactive = 0,
    Pending = 2,
}

describe("EnumCast", () => {
    describe("constructor()", () => {
        test("should create caster with enum object", () => {
            const caster = new EnumCast(StringStatus);
            expect(caster).toBeInstanceOf(EnumCast);
        });

        test("should create caster with options object", () => {
            const caster = new EnumCast({ enum: StringStatus, mode: "string" });
            expect(caster).toBeInstanceOf(EnumCast);
        });

        test("should create caster with enum object and mode parameter", () => {
            const caster = new EnumCast(NumberStatus, "number");
            expect(caster).toBeInstanceOf(EnumCast);
            expect(caster.getMode()).toBe("number");
        });

        test("should default to string mode", () => {
            const caster = new EnumCast(StringStatus);
            expect(caster.getEnumObject()).toBe(StringStatus);
            expect(caster.getMode()).toBe("string");
        });
    });

    describe("getType()", () => {
        test("should return enum type", () => {
            const caster = new EnumCast(StringStatus);
            expect(caster.getType()).toBe("enum");
        });
    });

    describe("getEnumObject()", () => {
        test("should return the enum object", () => {
            const caster = new EnumCast(StringStatus);
            expect(caster.getEnumObject()).toBe(StringStatus);
        });
    });

    describe("getMode()", () => {
        test("should return the cast mode", () => {
            const caster1 = new EnumCast(StringStatus);
            expect(caster1.getMode()).toBe("string");

            const caster2 = new EnumCast(NumberStatus, "number");
            expect(caster2.getMode()).toBe("number");
        });
    });

    describe("get() with string enum", () => {
        test("should convert string to enum value", () => {
            const caster = new EnumCast(StringStatus);
            const result = caster.get("active");

            expect(result).toBe(StringStatus.Active);
        });

        test("should return enum value unchanged", () => {
            const caster = new EnumCast(StringStatus);
            const result = caster.get(StringStatus.Active);

            expect(result).toBe(StringStatus.Active);
        });

        test("should handle case sensitivity", () => {
            const caster = new EnumCast(StringStatus);
            const result = caster.get("ACTIVE");

            // Should not match due to case sensitivity
            expect(result).toBe("ACTIVE");
        });

        test("should return null for null value", () => {
            const caster = new EnumCast(StringStatus);
            expect(caster.get(null)).toBe(null);
        });

        test("should return null for undefined value", () => {
            const caster = new EnumCast(StringStatus);
            expect(caster.get(undefined)).toBe(null);
        });

        test("should return original value if not found in enum", () => {
            const caster = new EnumCast(StringStatus);
            const result = caster.get("unknown");

            expect(result).toBe("unknown");
        });
    });

    describe("get() with number enum", () => {
        test("should convert number to enum value", () => {
            const caster = new EnumCast(NumberStatus, "number");
            const result = caster.get(1);

            expect(result).toBe(NumberStatus.Active);
        });

        test("should return enum value unchanged", () => {
            const caster = new EnumCast(NumberStatus, "number");
            const result = caster.get(NumberStatus.Active);

            expect(result).toBe(NumberStatus.Active);
        });

        test("should handle string number conversion", () => {
            const caster = new EnumCast(NumberStatus, "number");
            const result = caster.get("1");

            expect(result).toBe(NumberStatus.Active);
        });

        test("should return null for null value", () => {
            const caster = new EnumCast(NumberStatus, "number");
            expect(caster.get(null)).toBe(null);
        });
    });

    describe("set() with string enum", () => {
        test("should convert enum value to string for storage", () => {
            const caster = new EnumCast(StringStatus);
            const result = caster.set(StringStatus.Active);

            expect(typeof result).toBe("string");
            expect(result).toBe("active");
        });

        test("should convert string value to string for storage", () => {
            const caster = new EnumCast(StringStatus);
            const result = caster.set("active");

            expect(typeof result).toBe("string");
            expect(result).toBe("active");
        });

        test("should handle null values", () => {
            const caster = new EnumCast(StringStatus);
            const result = caster.set(null);

            expect(result).toBe(null);
        });
    });

    describe("set() with number enum", () => {
        test("should convert enum value to number for storage", () => {
            const caster = new EnumCast(NumberStatus, "number");
            const result = caster.set(NumberStatus.Active);

            expect(typeof result).toBe("number");
            expect(result).toBe(1);
        });

        test("should convert number value to number for storage", () => {
            const caster = new EnumCast(NumberStatus, "number");
            const result = caster.set(1);

            expect(typeof result).toBe("number");
            expect(result).toBe(1);
        });

        test("should handle null values", () => {
            const caster = new EnumCast(NumberStatus, "number");
            const result = caster.set(null);

            expect(result).toBe(null);
        });
    });

    describe("mode option", () => {
        test("should use string mode by default", () => {
            const caster = new EnumCast(StringStatus);
            const result = caster.set(StringStatus.Active);

            expect(typeof result).toBe("string");
        });

        test("should use number mode when specified with parameter", () => {
            const caster = new EnumCast(NumberStatus, "number");
            const result = caster.set(NumberStatus.Active);

            expect(typeof result).toBe("number");
        });

        test("should use number mode when specified with options object", () => {
            const caster = new EnumCast({ enum: NumberStatus, mode: "number" });
            const result = caster.set(NumberStatus.Active);

            expect(typeof result).toBe("number");
        });
    });
});
