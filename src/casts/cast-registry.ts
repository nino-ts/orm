/**
 * Cast Registry - Manages attribute casters for ORM models.
 *
 * Provides a centralized registry for casting attributes to specific types
 * when getting/setting model attributes.
 *
 * @packageDocumentation
 */

import type { CastType } from "../types";

/**
 * Interface for attribute casters.
 */
export interface AttributeCaster {
    /**
     * Get the cast type name.
     */
    getType(): CastType;

    /**
     * Cast a value when getting from model.
     *
     * @param value - The raw value from database
     * @returns The casted value
     */
    get(value: unknown): unknown;

    /**
     * Cast a value when setting to model.
     *
     * @param value - The value to set
     * @returns The casted value for storage
     */
    set(value: unknown): unknown;
}

/**
 * Registry for managing attribute casters.
 *
 * @example
 * ```typescript
 * const registry = new CastRegistry();
 * registry.register('custom', new CustomCaster());
 * const caster = registry.get('custom');
 * ```
 */
export class CastRegistry {
    /**
     * Map of registered casters by type.
     */
    protected casters: Map<CastType, AttributeCaster> = new Map();

    /**
     * Create a new cast registry with default casters.
     */
    constructor() {
        this.registerDefaults();
    }

    /**
     * Register default casters.
     */
    protected registerDefaults(): void {
        // Default casters are registered externally via imports
        // This method can be overridden to customize defaults
    }

    /**
     * Register a caster for a specific type.
     *
     * @param type - The cast type
     * @param caster - The caster instance
     */
    register(type: CastType, caster: AttributeCaster): void {
        this.casters.set(type, caster);
    }

    /**
     * Get a caster by type.
     *
     * @param type - The cast type
     * @returns The caster instance
     * @throws Error if caster not found
     */
    get(type: CastType): AttributeCaster {
        const caster = this.casters.get(type);
        if (!caster) {
            throw new Error(`Caster not registered for type: ${type}`);
        }
        return caster;
    }

    /**
     * Check if a caster is registered for a type.
     *
     * @param type - The cast type
     * @returns True if caster exists
     */
    has(type: CastType): boolean {
        return this.casters.has(type);
    }

    /**
     * Get all registered caster types.
     *
     * @returns Array of caster types
     */
    getTypes(): CastType[] {
        return Array.from(this.casters.keys());
    }

    /**
     * Remove a caster by type.
     *
     * @param type - The cast type
     */
    remove(type: CastType): void {
        this.casters.delete(type);
    }

    /**
     * Clear all registered casters.
     */
    clear(): void {
        this.casters.clear();
    }
}

/**
 * Global singleton cast registry instance.
 */
export const globalCastRegistry = new CastRegistry();
