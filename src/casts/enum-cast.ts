/**
 * Enum Cast - Casts attributes to TypeScript enum values.
 *
 * Handles conversion between enum values and their string/number representations.
 *
 * @packageDocumentation
 */

import type { AttributeCaster } from "./cast-registry";
import type { CastType } from "../types";

/**
 * Type for enum-like objects.
 */
export type EnumObject = Record<string | number, string | number>;

/**
 * Options for enum casting.
 */
export interface EnumCastOptions {
    /**
     * The enum object to cast to/from.
     */
    enum: EnumObject;

    /**
     * Whether to use string or numeric values.
     * @default 'string'
     */
    mode?: "string" | "number";
}

/**
 * Caster for enum attributes.
 *
 * Converts between enum values and their representations.
 *
 * @example
 * ```typescript
 * enum Status {
 *     Active = 'active',
 *     Inactive = 'inactive',
 * }
 *
 * const caster = new EnumCast({ enum: Status });
 * caster.get('active'); // Status.Active
 * caster.get(Status.Active); // 'active' (when setting)
 * ```
 */
export class EnumCast implements AttributeCaster {
    /**
     * The enum object to cast to/from.
     */
    protected readonly enumObject: EnumObject;

    /**
     * Cast mode: 'string' or 'number'.
     */
    protected readonly mode: "string" | "number";

    /**
     * Create a new enum caster.
     *
     * @param options - Enum cast options or enum object
     * @param mode - Optional mode when using enum object directly
     */
    constructor(options: EnumObject | EnumCastOptions, mode?: "string" | "number") {
        // Type guard to check if options is EnumCastOptions
        const isEnumCastOptions = (opts: EnumObject | EnumCastOptions): opts is EnumCastOptions => {
            return typeof opts === "object" && opts !== null && "enum" in opts;
        };

        if (isEnumCastOptions(options)) {
            this.enumObject = options.enum;
            this.mode = options.mode ?? "string";
        } else {
            this.enumObject = options;
            this.mode = mode ?? "string";
        }
    }

    /**
     * Get the cast type name.
     */
    getType(): CastType {
        return "enum";
    }

    /**
     * Get the enum object.
     */
    getEnumObject(): EnumObject {
        return this.enumObject;
    }

    /**
     * Get the cast mode.
     */
    getMode(): "string" | "number" {
        return this.mode;
    }

    /**
     * Cast a value when getting from model.
     *
     * @param value - The raw value from database
     * @returns Enum value or original value
     */
    get(value: unknown): unknown {
        if (value === null || value === undefined) {
            return null;
        }

        // If value is already a valid enum value, return it
        if (this.isValidEnumValue(value)) {
            return value;
        }

        // Try to find matching enum value
        const enumKeys = Object.keys(this.enumObject);

        // Filter out reverse mappings (numeric enums create reverse mappings)
        const validKeys = enumKeys.filter((key) => {
            const enumKey = key as keyof EnumObject;
            const enumValue = this.enumObject[enumKey];
            // Skip numeric keys that are reverse mappings
            return typeof enumValue !== "number" || Number.isNaN(Number(key));
        });

        for (const key of validKeys) {
            const enumValue = this.enumObject[key as keyof EnumObject];
            if (this.mode === "string" && String(value) === String(enumValue)) {
                return enumValue;
            }
            if (this.mode === "number" && Number(value) === Number(enumValue)) {
                return enumValue;
            }
        }

        // If no match found, return the original value
        return value;
    }

    /**
     * Cast a value when setting to model.
     *
     * @param value - The value to set
     * @returns String/number representation for storage
     */
    set(value: unknown): string | number | null {
        if (value === null || value === undefined) {
            return null;
        }

        // If it's a valid enum value, convert to storage format
        if (this.isValidEnumValue(value)) {
            // Find the key for this value
            const entries = Object.entries(this.enumObject);
            for (const [key, enumValue] of entries) {
                if (enumValue === value) {
                    // Skip reverse mappings
                    if (Number.isNaN(Number(key))) {
                        return this.mode === "number" ? Number(enumValue) : String(enumValue);
                    }
                }
            }
        }

        // Return as-is for storage, converted to the correct mode
        if (this.mode === "number") {
            const numValue = Number(value);
            return Number.isNaN(numValue) ? (value as string | number) : numValue;
        }
        return String(value);
    }

    /**
     * Check if a value is a valid enum value.
     *
     * @param value - Value to check
     * @returns True if valid enum value
     */
    protected isValidEnumValue(value: unknown): boolean {
        const enumValues = Object.values(this.enumObject);
        return enumValues.some((enumValue) => enumValue === value);
    }
}
