import type { Model } from "../model";
import type { QueryBuilder } from "../query-builder";

/**
 * Constructor type for mixin pattern.
 * Note: Mixin constructors accept unknown arguments and preserve the concrete model type.
 *
 * @template T - The base class type
 */
export type Constructor<T extends Model = Model> = new (...args: unknown[]) => T;
type ScopedConstructor<TBase extends Constructor> = TBase & {
    scope(name: string, ...args: unknown[]): QueryBuilder;
};

/**
 * Type for model class with scope methods.
 */
export interface ModelWithScopes {
    /**
     * Get a new query builder for the model.
     */
    query(): QueryBuilder;

    /**
     * Model class name.
     */
    name: string;

    /**
     * Scope methods are prefixed with 'scope'.
     */
    [key: `scope${string}`]: (query: QueryBuilder, ...args: unknown[]) => QueryBuilder;
}

/**
 * HasScopes mixin adds local scope support.
 *
 * @template TBase - The base constructor type
 *
 * @example
 * ```typescript
 * class User extends HasScopes(Model) {
 *     static scopeActive(query: QueryBuilder) {
 *         return query.where('active', '=', true);
 *     }
 *
 *     static scopeOlderThan(query: QueryBuilder, age: number) {
 *         return query.where('age', '>', age);
 *     }
 * }
 *
 * // Usage: User.scope('active').get()
 * // Or with params: User.scope('olderThan', 25).get()
 * ```
 */
export function HasScopes<TBase extends Constructor>(Base: TBase): ScopedConstructor<TBase> {
    function applyScope(this: ModelWithScopes, name: string, ...args: unknown[]): QueryBuilder {
        const scopeMethod = `scope${name.charAt(0).toUpperCase()}${name.slice(1)}` as const;

        const method = this[scopeMethod];
        if (typeof method !== "function") {
            throw new Error(`Scope '${name}' not found on ${this.name}`);
        }

        const query = this.query();
        return method(query, ...args);
    }

    const ModelBase = Base as Constructor;

    class HasScopesModel extends ModelBase {
        /**
         * Apply a local scope to the query.
         *
         * @param name - Scope name (without 'scope' prefix)
         * @param args - Arguments to pass to the scope method
         * @returns QueryBuilder with scope applied
         *
         * @throws Error if scope method not found
         *
         * @example
         * ```typescript
         * User.scope('active').get();
         * User.scope('olderThan', 25).get();
         * ```
         */
        static scope = applyScope;
    }

    return HasScopesModel as unknown as ScopedConstructor<TBase>;
}
