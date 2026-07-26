import type { Model } from "../model";
import type { QueryBuilder } from "../query-builder";
import { Relation } from "./relation";
import type { WhereClauseValue } from "../types";

/**
 * HasMany relation for one-to-many relationships.
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
 *
 * const posts = await user.posts().get();
 * ```
 */
export class HasMany<TRelated extends Model = Model, TParent extends Model = Model> extends Relation<
    TRelated,
    TParent
> {
    /**
     * Create a new HasMany instance.
     *
     * @param query - QueryBuilder instance
     * @param parent - Parent model instance
     * @param foreignKey - Foreign key on the related model
     * @param localKey - Local key on the parent model
     */
    constructor(
        query: QueryBuilder<TRelated>,
        parent: TParent,
        public foreignKey: string,
        public localKey: string,
    ) {
        super(query, parent);
        this.addConstraints();
    }

    /**
     * Add the base constraints for the relation query.
     */
    addConstraints(): void {
        if (this.parent.getAttribute(this.localKey)) {
            this.query.where(this.foreignKey, "=", this.parent.getAttribute(this.localKey) as WhereClauseValue);
        }
    }
}
