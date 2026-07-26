/**
 * Array Cast - Casts attributes to array values.
 *
 * Handles conversion of JSON strings and other values to arrays.
 *
 * @packageDocumentation
 */

import type { AttributeCaster } from "./cast-registry";

/**
 * Caster for array attributes.
 *
 * Converts JSON strings and other values to arrays.
 *
 * @example
 * ```typescript
 * const caster = new ArrayCast();
 * caster.get('["a", "b", "c"]'); // ['a', 'b', 'c']
 * caster.get('{"key": "value"}'); // ['key']
 * caster.get(null); // []
 * ```
 */
export class ArrayCast implements AttributeCaster {
    /**
     * Get the cast type name.
     */
    getType(): "array" {
        return "array";
    }

    /**
     * Cast a value when getting from model.
     *
     * @param value - The raw value from database
     * @returns Array value
     */
    get(value: unknown): unknown[] {
        if (value === null || value === undefined) {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
                // If it's an object, convert to array of keys or entries
                if (typeof parsed === "object" && parsed !== null) {
                    return Object.entries(parsed);
                }
                // Single value
                return [parsed];
            } catch {
                // Not valid JSON, return as single-element array
                return [value];
            }
        }

        if (typeof value === "object") {
            return Object.values(value as object);
        }

        return [value];
    }

    /**
     * Cast a value when setting to model.
     *
     * @param value - The value to set
     * @returns JSON string for storage
     */
    set(value: unknown): string {
        if (value === null || value === undefined) {
            return "[]";
        }

        if (Array.isArray(value)) {
            return JSON.stringify(value);
        }

        return JSON.stringify([value]);
    }
}

/**
 * JSON Cast - Casts attributes to JSON objects/arrays.
 *
 * Similar to ArrayCast but preserves object structure.
 */
export class JsonCast implements AttributeCaster {
    /**
     * Get the cast type name.
     */
    getType(): "json" {
        return "json";
    }

    /**
     * Cast a value when getting from model.
     *
     * @param value - The raw value from database
     * @returns Parsed JSON value
     */
    get(value: unknown): unknown {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === "object") {
            return value;
        }

        if (typeof value === "string") {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }

        return value;
    }

    /**
     * Cast a value when setting to model.
     *
     * @param value - The value to set
     * @returns JSON string for storage
     */
    set(value: unknown): string {
        if (value === null || value === undefined) {
            return "null";
        }

        return JSON.stringify(value);
    }
}
