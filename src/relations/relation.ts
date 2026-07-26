import type { Collection } from "../collection";
import type { Model } from "../model";
import { QueryBuilder } from "../query-builder";
import type { ModelConstructor } from "../types";

/**
 * Base abstract class for all database relationships.
 *
 * @template TRelated - The related model type
 * @template TParent - The parent model type
 *
 * @example
 * ```typescript
 * class User extends Model {
 *     posts() {
 *         return this.hasMany(Post, 'user_id', 'id');
 *     }
 * }
 * ```
 */
export abstract class Relation<TRelated extends Model = Model, TParent extends Model = Model> {
    protected query: QueryBuilder<TRelated>;
    protected parent: TParent;
    protected related: ModelConstructor<TRelated> | undefined;

    /**
     * Create a new Relation instance.
     *
     * @param query - QueryBuilder instance for the related model
     * @param parent - Parent model instance
     *
     * @example
     * ```typescript
     * const relation = new HasMany(query, parentModel, 'user_id', 'id');
     * ```
     */
    constructor(query: QueryBuilder<TRelated>, parent: TParent) {
        this.query = query;
        this.parent = parent;
        // Get model class from QueryBuilder if available
        this.related = this.getModelClassFromQuery(query);
    }

    /**
     * Extract model class from QueryBuilder.
     *
     * @param query - QueryBuilder instance
     * @returns Model constructor or undefined
     */
    protected getModelClassFromQuery(query: QueryBuilder<TRelated>): ModelConstructor<TRelated> | undefined {
        // Access the modelClass property using a type-safe approach
        const queryWithModel = query as QueryBuilder<TRelated> & {
            modelClass?: ModelConstructor<TRelated>;
        };
        return queryWithModel.modelClass;
    }

    /**
     * Add the constraints for the relationship query.
     *
     * @example
     * ```typescript
     * addConstraints(): void {
     *     this.query.where(this.foreignKey, '=', this.parent.getAttribute(this.localKey));
     * }
     * ```
     */
    abstract addConstraints(): void;

    /**
     * Get the query builder for the relationship.
     *
     * @returns QueryBuilder instance
     */
    getQuery(): QueryBuilder<TRelated> {
        return this.query;
    }

    /**
     * Get a fresh query builder for eager loading (without parent constraints).
     *
     * @returns New QueryBuilder instance without constraints
     *
     * @example
     * ```typescript
     * const freshQuery = relation.getBaseQuery();
     * ```
     */
    getBaseQuery(): QueryBuilder<TRelated> {
        const qb = new QueryBuilder<TRelated>(this.query.connection);
        qb.from(this.query.fromTable);
        if (this.related) {
            qb.setModel(this.related);
        }
        return qb;
    }

    /**
     * Execute the query and get the results as a Collection.
     *
     * @returns Promise resolving to a Collection of related models
     *
     * @example
     * ```typescript
     * const posts = await user.posts().get();
     * ```
     */
    async get(): Promise<Collection<TRelated>> {
        return this.query.get<TRelated>();
    }

    /**
     * Execute the query and get the first result.
     *
     * @returns Promise resolving to the first related model or null
     *
     * @example
     * ```typescript
     * const latestPost = await user.posts().first();
     * ```
     */
    async first(): Promise<TRelated | null> {
        return this.query.first<TRelated>();
    }
}
