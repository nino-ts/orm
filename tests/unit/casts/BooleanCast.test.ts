/**
 * Boolean Cast Tests.
 *
 * Tests for the BooleanCast class.
 */

import { describe, expect, test } from "bun:test";
import { BooleanCast } from "../../../src/casts/boolean-cast";

describe("BooleanCast", () => {
    describe("getType()", () => {
        test("should return boolean type", () => {
            const caster = new BooleanCast();
            expect(caster.getType()).toBe("boolean");
        });
    });

    describe("get()", () => {
        test("should convert true boolean to true", () => {
            const caster = new BooleanCast();
            expect(caster.get(true)).toBe(true);
        });

        test("should convert false boolean to false", () => {
            const caster = new BooleanCast();
            expect(caster.get(false)).toBe(false);
        });

        test("should convert 1 to true", () => {
            const caster = new BooleanCast();
            expect(caster.get(1)).toBe(true);
        });

        test("should convert 0 to false", () => {
            const caster = new BooleanCast();
            expect(caster.get(0)).toBe(false);
        });

        test("should convert non-zero numbers to true", () => {
            const caster = new BooleanCast();
            expect(caster.get(42)).toBe(true);
            expect(caster.get(-1)).toBe(true);
        });

        test('should convert "true" string to true', () => {
            const caster = new BooleanCast();
            expect(caster.get("true")).toBe(true);
            expect(caster.get("TRUE")).toBe(true);
            expect(caster.get("True")).toBe(true);
        });

        test('should convert "false" string to false', () => {
            const caster = new BooleanCast();
            expect(caster.get("false")).toBe(false);
            expect(caster.get("FALSE")).toBe(false);
        });

        test('should convert "1" string to true', () => {
            const caster = new BooleanCast();
            expect(caster.get("1")).toBe(true);
        });

        test('should convert "0" string to false', () => {
            const caster = new BooleanCast();
            expect(caster.get("0")).toBe(false);
        });

        test('should convert "yes" string to true', () => {
            const caster = new BooleanCast();
            expect(caster.get("yes")).toBe(true);
            expect(caster.get("YES")).toBe(true);
        });

        test('should convert "no" string to false', () => {
            const caster = new BooleanCast();
            expect(caster.get("no")).toBe(false);
        });

        test('should convert "on" string to true', () => {
            const caster = new BooleanCast();
            expect(caster.get("on")).toBe(true);
        });

        test('should convert "off" string to false', () => {
            const caster = new BooleanCast();
            expect(caster.get("off")).toBe(false);
        });

        test("should convert empty string to false", () => {
            const caster = new BooleanCast();
            expect(caster.get("")).toBe(false);
        });

        test("should convert null to false", () => {
            const caster = new BooleanCast();
            expect(caster.get(null)).toBe(false);
        });

        test("should convert undefined to false", () => {
            const caster = new BooleanCast();
            expect(caster.get(undefined)).toBe(false);
        });

        test("should convert object to true", () => {
            const caster = new BooleanCast();
            expect(caster.get({})).toBe(true);
            expect(caster.get({ key: "value" })).toBe(true);
        });

        test("should convert array to true", () => {
            const caster = new BooleanCast();
            expect(caster.get([])).toBe(true);
            expect(caster.get([1, 2, 3])).toBe(true);
        });
    });

    describe("set()", () => {
        test("should convert value to boolean for storage", () => {
            const caster = new BooleanCast();
            expect(caster.set("true")).toBe(true);
            expect(caster.set("false")).toBe(false);
            expect(caster.set(1)).toBe(true);
            expect(caster.set(0)).toBe(false);
        });

        test("should handle null values", () => {
            const caster = new BooleanCast();
            expect(caster.set(null)).toBe(false);
        });
    });
});
