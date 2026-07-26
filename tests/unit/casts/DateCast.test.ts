/**
 * Date Cast Tests.
 *
 * Tests for the DateCast, DateTimeCast, and TimestampCast classes.
 */

import { describe, expect, test } from "bun:test";
import { DateCast, DateTimeCast, TimestampCast } from "../../../src/casts/date-cast";

describe("DateCast", () => {
    describe("getType()", () => {
        test("should return date type", () => {
            const caster = new DateCast();
            expect(caster.getType()).toBe("date");
        });
    });

    describe("get()", () => {
        test("should convert Date string to Date instance", () => {
            const caster = new DateCast();
            const result = caster.get("2024-01-15T10:30:00Z");

            expect(result).toBeInstanceOf(Date);
            expect(result?.getFullYear()).toBe(2024);
            expect(result?.getMonth()).toBe(0); // January is 0
            expect(result?.getDate()).toBe(15);
        });

        test("should convert ISO date string to Date instance", () => {
            const caster = new DateCast();
            const result = caster.get("2024-06-20");

            expect(result).toBeInstanceOf(Date);
        });

        test("should convert timestamp in milliseconds to Date", () => {
            const caster = new DateCast();
            const timestamp = 1705312800000; // 2024-01-15
            const result = caster.get(timestamp);

            expect(result).toBeInstanceOf(Date);
            expect(result?.getTime()).toBe(timestamp);
        });

        test("should convert timestamp in seconds to Date", () => {
            const caster = new DateCast();
            const timestamp = 1705312800; // 2024-01-15 in seconds
            const result = caster.get(timestamp);

            expect(result).toBeInstanceOf(Date);
            expect(result?.getTime()).toBe(timestamp * 1000);
        });

        test("should return Date instance unchanged", () => {
            const caster = new DateCast();
            const date = new Date("2024-01-15");
            const result = caster.get(date);

            expect(result).toBe(date);
        });

        test("should return null for null value", () => {
            const caster = new DateCast();
            expect(caster.get(null)).toBe(null);
        });

        test("should return null for undefined value", () => {
            const caster = new DateCast();
            expect(caster.get(undefined)).toBe(null);
        });

        test("should return null for invalid date string", () => {
            const caster = new DateCast();
            expect(caster.get("not-a-date")).toBe(null);
        });

        test("should return null for invalid values", () => {
            const caster = new DateCast();
            expect(caster.get(true)).toBe(null);
            expect(caster.get(false)).toBe(null);
        });
    });

    describe("set()", () => {
        test("should convert value to Date for storage", () => {
            const caster = new DateCast();
            const result = caster.set("2024-01-15");

            expect(result).toBeInstanceOf(Date);
        });

        test("should handle null values", () => {
            const caster = new DateCast();
            expect(caster.set(null)).toBe(null);
        });
    });
});

describe("DateTimeCast", () => {
    describe("getType()", () => {
        test("should return datetime type", () => {
            const caster = new DateTimeCast();
            expect(caster.getType()).toBe("datetime");
        });
    });

    test("should inherit from DateCast", () => {
        const caster = new DateTimeCast();
        const result = caster.get("2024-01-15T10:30:00Z");

        expect(result).toBeInstanceOf(Date);
    });
});

describe("TimestampCast", () => {
    describe("getType()", () => {
        test("should return timestamp type", () => {
            const caster = new TimestampCast();
            expect(caster.getType()).toBe("timestamp");
        });
    });

    describe("get()", () => {
        test("should return timestamp number from Date string", () => {
            const caster = new TimestampCast();
            const result = caster.get("2024-01-15T00:00:00Z");

            expect(typeof result).toBe("number");
            expect(result).toBeGreaterThan(0);
        });

        test("should return timestamp number from Date instance", () => {
            const caster = new TimestampCast();
            const date = new Date("2024-01-15T00:00:00Z");
            const result = caster.get(date);

            expect(typeof result).toBe("number");
            expect(result).toBe(date.getTime());
        });

        test("should return null for invalid date", () => {
            const caster = new TimestampCast();
            expect(caster.get("not-a-date")).toBe(null);
        });

        test("should return null for null value", () => {
            const caster = new TimestampCast();
            expect(caster.get(null)).toBe(null);
        });
    });

    describe("set()", () => {
        test("should convert value to Date for storage", () => {
            const caster = new TimestampCast();
            const result = caster.set("2024-01-15");

            expect(result).toBeInstanceOf(Date);
        });
    });
});
