/**
 * Date Cast - Casts attributes to Date objects.
 *
 * Handles conversion of timestamps, strings, and numbers to Date instances.
 *
 * @packageDocumentation
 */

import type { AttributeCaster } from "./cast-registry";
import type { CastType } from "../types";

/**
 * Caster for date attributes.
 *
 * Converts various date formats to Date objects.
 *
 * @example
 * ```typescript
 * const caster = new DateCast();
 * caster.get('2024-01-15'); // Date instance
 * caster.get(1705312800000); // Date from timestamp
 * caster.get(new Date()); // Date (unchanged)
 * ```
 */
export class DateCast implements AttributeCaster {
    /**
     * Get the cast type name.
     */
    getType(): CastType {
        return "date";
    }

    /**
     * Cast a value when getting from model.
     *
     * @param value - The raw value from database
     * @returns Date instance or null
     */
    get(value: unknown): Date | null {
        if (value === null || value === undefined) {
            return null;
        }

        if (value instanceof Date) {
            return value;
        }

        if (typeof value === "number") {
            // Check if it's a reasonable timestamp
            // Unix timestamps in seconds (10 digits) or milliseconds (13 digits)
            if (value > 9999999999) {
                // Milliseconds
                return new Date(value);
            } else {
                // Seconds - convert to milliseconds
                return new Date(value * 1000);
            }
        }

        if (typeof value === "string") {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return null;
            }
            return date;
        }

        return null;
    }

    /**
     * Cast a value when setting to model.
     *
     * @param value - The value to set
     * @returns Date instance or null for storage
     */
    set(value: unknown): Date | null {
        return this.get(value);
    }
}

/**
 * DateTime Cast - Alias for DateCast with datetime type.
 */
export class DateTimeCast extends DateCast {
    /**
     * Get the cast type name.
     */
    override getType(): CastType {
        return "datetime";
    }
}

/**
 * Timestamp Cast - Casts to Date but returns timestamp number.
 *
 * Note: This class does not extend DateCast because the return type of get() is different.
 */
export class TimestampCast implements AttributeCaster {
    /**
     * Get the cast type name.
     */
    getType(): CastType {
        return "timestamp";
    }

    /**
     * Cast a value when getting from model.
     *
     * @param value - The raw value from database
     * @returns Timestamp number or null
     */
    get(value: unknown): number | null {
        if (value === null || value === undefined) {
            return null;
        }

        let date: Date | null = null;

        if (value instanceof Date) {
            date = value;
        } else if (typeof value === "number") {
            // Check if it's a reasonable timestamp
            if (value > 9999999999) {
                // Milliseconds
                date = new Date(value);
            } else {
                // Seconds - convert to milliseconds
                date = new Date(value * 1000);
            }
        } else if (typeof value === "string") {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime())) {
                date = d;
            }
        }

        if (date === null) {
            return null;
        }
        return date.getTime();
    }

    /**
     * Cast a value when setting to model.
     *
     * @param value - The value to set
     * @returns Date instance for storage
     */
    set(value: unknown): Date | null {
        if (value === null || value === undefined) {
            return null;
        }

        if (value instanceof Date) {
            return value;
        }

        if (typeof value === "number") {
            if (value > 9999999999) {
                return new Date(value);
            } else {
                return new Date(value * 1000);
            }
        }

        if (typeof value === "string") {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return null;
            }
            return date;
        }

        return null;
    }
}
