/**
 * Boolean Cast - Casts attributes to boolean values.
 *
 * Handles conversion of various truthy/falsy values to boolean.
 *
 * @packageDocumentation
 */

import type { AttributeCaster } from "./cast-registry";

/**
 * Caster for boolean attributes.
 *
 * Converts truthy/falsy values to proper booleans.
 *
 * @example
 * ```typescript
 * const caster = new BooleanCast();
 * caster.get(1); // true
 * caster.get(0); // false
 * caster.get('true'); // true
 * caster.get('false'); // false
 * ```
 */
export class BooleanCast implements AttributeCaster {
    /**
     * Get the cast type name.
     */
    getType(): "boolean" {
        return "boolean";
    }

    /**
     * Cast a value when getting from model.
     *
     * @param value - The raw value from database
     * @returns Boolean value
     */
    get(value: unknown): boolean {
        if (value === null || value === undefined) {
            return false;
        }

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number") {
            return value !== 0;
        }

        if (typeof value === "string") {
            const lower = value.toLowerCase();
            // Truthy strings
            if (lower === "true" || lower === "1" || lower === "yes" || lower === "on") {
                return true;
            }
            // Falsy strings
            if (lower === "false" || lower === "0" || lower === "no" || lower === "off" || lower === "") {
                return false;
            }
            // Fallback to boolean conversion
            return Boolean(value);
        }

        return Boolean(value);
    }

    /**
     * Cast a value when setting to model.
     *
     * @param value - The value to set
     * @returns Boolean value for storage
     */
    set(value: unknown): boolean {
        return this.get(value);
    }
}
