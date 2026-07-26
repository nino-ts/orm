/**
 * Fluent wrapper for working with arrays of data.
 *
 * Provides Laravel-style collection methods for filtering, mapping, and
 * transforming data with full type safety.
 *
 * @template T - The type of items in the collection (must be specified, no default)
 *
 * @packageDocumentation
 */

import type { QueryBuilder } from "./query-builder";
import type { ModelInstance, WhereClauseValue } from "./types";

/**
 * Type-safe fluent collection for working with arrays of data.
 *
 * Zero `any` types - all operations are fully type-checked.
 *
 * @example
 * ```typescript
 * interface User {
 *     id: number;
 *     name: string;
 *     age: number;
 * }
 *
 * const users = new Collection<User>([
 *     { id: 1, name: 'Alice', age: 25 },
 *     { id: 2, name: 'Bob', age: 30 },
 * ]);
 *
 * const names = users.pluck('name'); // Collection<string>
 * const avgAge = users.avg('age'); // number
 * ```
 */
export class Collection<T> implements Iterable<T> {
    /**
     * Internal items array.
     */
    protected readonly items: readonly T[];

    /**
     * Create a new Collection instance.
     *
     * @param items - Initial array of items
     */
    constructor(items: readonly T[] = []) {
        // Freeze array for immutability (shallow freeze)
        this.items = Object.freeze([...items]);
    }

    /**
     * Get the iterator for the collection items.
     *
     * Enables `for...of` loops and spread operator.
     *
     * @returns Iterator over collection items
     */
    [Symbol.iterator](): Iterator<T> {
        return this.items[Symbol.iterator]();
    }

    /**
     * Get all items in the collection as an array.
     *
     * @returns Array copy of collection items
     */
    all(): T[] {
        return [...this.items];
    }

    /**
     * Get the number of items in the collection.
     *
     * @returns Item count
     */
    count(): number {
        return this.items.length;
    }

    /**
     * Get the number of items (alias for count).
     *
     * @returns Item count
     */
    length(): number {
        return this.count();
    }

    /**
     * Get the first item in the collection, or null if empty.
     *
     * @returns First item or null
     */
    first(): T | null {
        return this.items[0] ?? null;
    }

    /**
     * Get the first item or throw if collection is empty.
     *
     * @returns First item
     * @throws Error if collection is empty
     */
    firstOrFail(): T {
        const first = this.first();
        if (first === null) {
            throw new Error("Collection is empty, cannot get first item");
        }
        return first;
    }

    /**
     * Get the last item in the collection, or undefined if empty.
     *
     * @returns Last item or undefined
     */
    last(): T | undefined {
        return this.items[this.count() - 1];
    }

    /**
     * Get the last item or throw if collection is empty.
     *
     * @returns Last item
     * @throws Error if collection is empty
     */
    lastOrFail(): T {
        const last = this.last();
        if (last === undefined) {
            throw new Error("Collection is empty, cannot get last item");
        }
        return last;
    }

    /**
     * Map over the collection and return a new Collection.
     *
     * @template U - The type of items in the new collection
     * @param callback - Mapping function
     * @returns New Collection with mapped items
     *
     * @example
     * ```typescript
     * const numbers = new Collection([1, 2, 3]);
     * const doubled = numbers.map(n => n * 2); // Collection<number>
     * ```
     */
    map<U>(callback: (item: T, index: number) => U): Collection<U> {
        return new Collection<U>(this.items.map((item, index) => callback(item, index)));
    }

    /**
     * Filter the collection and return a new Collection.
     *
     * @param callback - Filter predicate
     * @returns New Collection with filtered items
     *
     * @example
     * ```typescript
     * const users = new Collection([{ age: 20 }, { age: 30 }]);
     * const adults = users.filter(u => u.age >= 25); // Collection<User>
     * ```
     */
    filter(callback: (item: T, index: number) => boolean): Collection<T> {
        return new Collection<T>(this.items.filter((item, index) => callback(item, index)));
    }

    /**
     * Pluck a specific key from all items in the collection.
     *
     * Type-safe version that ensures the key exists on items.
     *
     * @template K - The key type to pluck
     * @param key - Key to pluck from each item
     * @returns New Collection with plucked values
     *
     * @example
     * ```typescript
     * const users = new Collection([{ id: 1, name: 'Alice' }]);
     * const names = users.pluck('name'); // Collection<string>
     * ```
     */
    pluck<K extends keyof T>(key: K): Collection<T[K]> {
        return this.map((item: T): T[K] => item[key]);
    }

    /**
     * Push items onto the end of the collection (returns new collection).
     *
     * Note: Returns a new Collection to maintain immutability.
     *
     * @param items - Items to add
     * @returns New Collection with added items
     */
    push(...items: readonly T[]): Collection<T> {
        return new Collection<T>([...this.items, ...items]);
    }

    /**
     * Remove and return the last item from the collection (returns new collection).
     *
     * Note: Returns both the item and new Collection to maintain immutability.
     *
     * @returns Tuple of [popped item, new collection]
     */
    pop(): readonly [T | undefined, Collection<T>] {
        const newItems = [...this.items];
        const popped = newItems.pop();
        return [popped, new Collection<T>(newItems)];
    }

    /**
     * Calculate the sum of a given key (if objects) or the items themselves (if numbers).
     *
     * @param key - Optional key to sum by
     * @returns Sum of values
     *
     * @example
     * ```typescript
     * const orders = new Collection([{ total: 100 }, { total: 200 }]);
     * const totalRevenue = orders.sum('total'); // 300
     * ```
     */
    sum(key?: keyof T): number {
        return this.items.reduce((sum: number, item: T): number => {
            const value = key !== undefined ? item[key] : item;
            const numValue = Number(value);
            return sum + (Number.isNaN(numValue) ? 0 : numValue);
        }, 0);
    }

    /**
     * Calculate the average of a given key or the items themselves.
     *
     * @param key - Optional key to average by
     * @returns Average value
     */
    avg(key?: keyof T): number {
        if (this.isEmpty()) {
            return 0;
        }
        return this.sum(key) / this.count();
    }

    /**
     * Get the minimum value.
     *
     * @param key - Optional key to inspect
     * @returns Minimum value
     */
    min(key?: keyof T): number {
        if (this.isEmpty()) {
            return 0;
        }

        const values = this.items.map((item: T): number => {
            const value = key !== undefined ? item[key] : item;
            return Number(value);
        });

        return Math.min(...values);
    }

    /**
     * Get the maximum value.
     *
     * @param key - Optional key to inspect
     * @returns Maximum value
     */
    max(key?: keyof T): number {
        if (this.isEmpty()) {
            return 0;
        }

        const values = this.items.map((item: T): number => {
            const value = key !== undefined ? item[key] : item;
            return Number(value);
        });

        return Math.max(...values);
    }

    /**
     * Return unique items in the collection.
     *
     * @param key - Optional key to ensure uniqueness by
     * @returns New Collection with unique items
     *
     * @example
     * ```typescript
     * const users = new Collection([
     *     { id: 1, name: 'Alice' },
     *     { id: 2, name: 'Bob' },
     *     { id: 1, name: 'Alice' },
     * ]);
     * const uniqueUsers = users.unique('id'); // 2 items
     * ```
     */
    unique(key?: keyof T): Collection<T> {
        if (key === undefined) {
            return new Collection<T>([...new Set(this.items)]);
        }

        const seen = new Set<T[keyof T]>();
        return this.filter((item: T): boolean => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }

    /**
     * Sort the collection by a key or callback.
     *
     * @param keyOrCallback - Key to sort by or custom comparator
     * @param direction - Sort direction ('asc' or 'desc')
     * @returns New sorted Collection
     *
     * @example
     * ```typescript
     * const users = new Collection([{ age: 30 }, { age: 20 }]);
     * const sorted = users.sortBy('age'); // [{ age: 20 }, { age: 30 }]
     * ```
     */
    sortBy(keyOrCallback: keyof T | ((a: T, b: T) => number), direction: "asc" | "desc" = "asc"): Collection<T> {
        const sorted = [...this.items];

        if (typeof keyOrCallback === "function") {
            sorted.sort(keyOrCallback);
        } else {
            sorted.sort((a: T, b: T): number => {
                const aVal = a[keyOrCallback];
                const bVal = b[keyOrCallback];

                if (aVal < bVal) {
                    return direction === "asc" ? -1 : 1;
                }
                if (aVal > bVal) {
                    return direction === "asc" ? 1 : -1;
                }
                return 0;
            });
        }

        return new Collection<T>(sorted);
    }

    /**
     * Chunk the collection into smaller collections of a given size.
     *
     * @param size - Chunk size
     * @returns Collection of chunked collections
     *
     * @example
     * ```typescript
     * const numbers = new Collection([1, 2, 3, 4, 5]);
     * const chunks = numbers.chunk(2); // [[1, 2], [3, 4], [5]]
     * ```
     */
    chunk(size: number): Collection<Collection<T>> {
        const chunks: Collection<T>[] = [];

        for (let i = 0; i < this.items.length; i += size) {
            chunks.push(new Collection<T>(this.items.slice(i, i + size)));
        }

        return new Collection<Collection<T>>(chunks);
    }

    /**
     * Take the first N items from the collection.
     *
     * @param count - Number of items to take
     * @returns New Collection with first N items
     */
    take(count: number): Collection<T> {
        return new Collection<T>(this.items.slice(0, count));
    }

    /**
     * Skip the first N items and return the rest.
     *
     * @param count - Number of items to skip
     * @returns New Collection with remaining items
     */
    skip(count: number): Collection<T> {
        return new Collection<T>(this.items.slice(count));
    }

    /**
     * Determine if the collection is empty.
     *
     * @returns True if collection has no items
     */
    isEmpty(): boolean {
        return this.count() === 0;
    }

    /**
     * Determine if the collection is not empty.
     *
     * @returns True if collection has items
     */
    isNotEmpty(): boolean {
        return !this.isEmpty();
    }

    /**
     * Convert the collection to a plain array.
     *
     * @returns Array of items
     */
    toArray(): T[] {
        return this.all();
    }

    /**
     * Convert the collection to a JSON string.
     *
     * @returns JSON string representation
     */
    toJSON(): string {
        return JSON.stringify(this.items);
    }

    /**
     * Reduce the collection to a single value.
     *
     * @template U - The type of the accumulated value
     * @param callback - Reducer function
     * @param initialValue - Initial value for accumulator
     * @returns Reduced value
     *
     * @example
     * ```typescript
     * const numbers = new Collection([1, 2, 3]);
     * const sum = numbers.reduce((acc, n) => acc + n, 0); // 6
     * ```
     */
    reduce<U>(callback: (accumulator: U, item: T, index: number) => U, initialValue: U): U {
        return this.items.reduce((acc: U, item: T, index: number): U => {
            return callback(acc, item, index);
        }, initialValue);
    }

    /**
     * Check if the collection contains an item.
     *
     * @param valueOrCallback - Value to find or predicate function
     * @returns True if item is found
     */
    contains(valueOrCallback: T | ((item: T) => boolean)): boolean {
        if (typeof valueOrCallback === "function") {
            return this.items.some(valueOrCallback as (item: T) => boolean);
        }
        return this.items.includes(valueOrCallback);
    }

    /**
     * Lazy eager load relations on all models in the collection.
     *
     * @param relations - Relation names to load
     * @returns This collection for chaining
     *
     * @example
     * ```typescript
     * const users = await User.all();
     * await users.load('posts', 'profile');
     * ```
     */
    async load(...relations: readonly string[]): Promise<this> {
        await Promise.all(
            relations.map(async (relationName) => {
                const models = this.items as readonly ModelInstance[];
                if (models.length === 0) {
                    return;
                }

                // Get the first model to access the relation definition
                const firstModel = models[0];
                if (!firstModel) {
                    return;
                }

                // Check if relation method exists
                const relationMethod = (firstModel as Record<string, unknown>)[relationName];
                if (typeof relationMethod !== "function") {
                    return;
                }

                // Get relation instance
                const relation = relationMethod.call(firstModel) as {
                    constructor: { name: string };
                    foreignKey: string;
                    ownerKey: string;
                    getBaseQuery: () => QueryBuilder;
                };
                const relationType = relation.constructor.name;

                if (relationType === "HasMany" || relationType === "HasOne") {
                    // Collect parent IDs
                    const parentIds = models
                        .map((m): WhereClauseValue => (m as Record<string, unknown>).id as WhereClauseValue)
                        .filter((id): id is NonNullable<WhereClauseValue> => id !== null && id !== undefined);

                    if (parentIds.length === 0) {
                        return;
                    }

                    // Fetch all related models
                    const relatedModels = await relation.getBaseQuery().whereIn(relation.foreignKey, parentIds).get();

                    if (relationType === "HasMany") {
                        // Group by foreign key and assign
                        for (const model of models) {
                            const related = relatedModels.filter((r: ModelInstance): boolean => {
                                const fkValue = (r as Record<string, unknown>)[relation.foreignKey];
                                const modelId = (model as Record<string, unknown>).id;
                                return fkValue === modelId;
                            });
                            if (model.setRelation) {
                                model.setRelation(relationName, new Collection([...related]));
                            }
                        }
                    } else {
                        // HasOne: assign single model
                        for (const model of models) {
                            const related = relatedModels.all().find((r: ModelInstance): boolean => {
                                const fkValue = (r as Record<string, unknown>)[relation.foreignKey];
                                const modelId = (model as Record<string, unknown>).id;
                                return fkValue === modelId;
                            });
                            if (model.setRelation) {
                                model.setRelation(relationName, related ?? null);
                            }
                        }
                    }
                } else if (relationType === "BelongsTo") {
                    // Collect foreign key values
                    const foreignKeyValues = models
                        .map(
                            (m): WhereClauseValue =>
                                (m as Record<string, unknown>)[relation.foreignKey] as WhereClauseValue,
                        )
                        .filter((id): id is NonNullable<WhereClauseValue> => id !== null && id !== undefined);

                    if (foreignKeyValues.length === 0) {
                        return;
                    }

                    // Fetch all related models
                    const relatedModels = await relation
                        .getBaseQuery()
                        .whereIn(relation.ownerKey, foreignKeyValues)
                        .get();

                    // Assign related models by owner key
                    for (const model of models) {
                        const fkValue = (model as Record<string, unknown>)[relation.foreignKey];
                        const related = relatedModels.all().find((r: ModelInstance): boolean => {
                            const ownerValue = (r as Record<string, unknown>)[relation.ownerKey];
                            return ownerValue === fkValue;
                        });
                        if (model.setRelation) {
                            model.setRelation(relationName, related ?? null);
                        }
                    }
                }
            }),
        );
        return this;
    }

    /**
     * Execute a callback for each item in the collection.
     *
     * @param callback - Callback function
     * @returns This collection for chaining
     */
    each(callback: (item: T, index: number) => undefined | boolean): this {
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (item === undefined) {
                continue;
            }

            const result = callback(item, i);
            // Stop iteration if callback returns false
            if (result === false) {
                break;
            }
        }
        return this;
    }
}
