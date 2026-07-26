import type { Model } from "../model";
import type { QueryBuilder } from "../query-builder";
import { Relation } from "./relation";
import type { WhereClauseValue } from "../types";

/**
 * BelongsTo relation for inverse one-to-one or many-to-one relationships.
 *
 * @template TRelated - The related model type
 * @template TParent - The parent model type
 *
 * @example
 * ```typescript
 * class Post extends Model {
 *     user() {
 *         return this.belongsTo(User, 'user_id', 'id');
 *     }
 * }
 *
 * const user = await post.user().first();
 * ```
 */
export class BelongsTo<TRelated extends Model = Model, TParent extends Model = Model> extends Relation<
    TRelated,
    TParent
> {
    /**
     * Create a new BelongsTo instance.
     *
     * @param query - QueryBuilder instance
     * @param parent - Parent model instance
     * @param foreignKey - Foreign key on the parent model
     * @param ownerKey - Primary key on the related model
     */
    constructor(
        query: QueryBuilder<TRelated>,
        parent: TParent,
        public foreignKey: string,
        public ownerKey: string,
    ) {
        super(query, parent);
        this.addConstraints();
    }

    /**
     * Add the base constraints for the relation query.
     */
    addConstraints(): void {
        const foreignKey = this.parent.getAttribute(this.foreignKey);
        if (foreignKey) {
            this.query.where(this.ownerKey, "=", foreignKey as WhereClauseValue);
        }
    }
}
