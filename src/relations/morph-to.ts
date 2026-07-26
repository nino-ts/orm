/**
 * MorphTo - Polymorphic BelongsTo Relationship.
 *
 * Handles the inverse side of polymorphic relationships where a model
 * can belong to different types of models.
 *
 * @packageDocumentation
 */

import type { Model } from "../model";
import type { QueryBuilder } from "../query-builder";
import { Relation } from "./relation";
import type { ModelConstructor, PrimaryKey, WhereClauseValue } from "../types";

/**
 * Type mapping for morph types to model classes.
 */
export type MorphTypeMap = Record<string, ModelConstructor<Model>>;

/**
 * MorphTo relationship for polymorphic belongsTo associations.
 *
 * @template TParent - The parent model type
 *
 * @example
 * ```typescript
 * class Comment extends Model {
 *     commentable() {
 *         return this.morphTo(Commentable, 'commentable_type', 'commentable_id');
 *     }
 * }
 *
 * const comment = await Comment.find(1);
 * const commentable = await comment.commentable().get(); // Returns User or Post
 * ```
 */
export class MorphTo<TParent extends Model = Model> extends Relation<Model, TParent> {
    /**
     * The foreign key type column name (e.g., 'commentable_type').
     */
    public morphType: string;

    /**
     * The foreign key ID column name (e.g., 'commentable_id').
     */
    public morphId: string;

    /**
     * The owner key on the related model.
     */
    public ownerKey: string;

    /**
     * Map of morph types to model classes.
     */
    protected morphMap: MorphTypeMap = {};

    /**
     * Create a new MorphTo instance.
     *
     * @param query - QueryBuilder instance
     * @param parent - Parent model instance
     * @param morphType - Morph type column name
     * @param morphId - Morph ID column name
     * @param ownerKey - Owner key on related model
     * @param morphMap - Optional map of morph types to model classes
     */
    constructor(
        query: QueryBuilder<Model>,
        parent: TParent,
        morphType: string,
        morphId: string,
        ownerKey: string,
        morphMap?: MorphTypeMap,
    ) {
        super(query, parent);
        this.morphType = morphType;
        this.morphId = morphId;
        this.ownerKey = ownerKey;
        if (morphMap) {
            this.morphMap = morphMap;
        }
        this.addConstraints();
    }

    /**
     * Add the constraints for the relationship query.
     */
    addConstraints(): void {
        // Constraints are added dynamically based on the morph type
        const morphTypeValue = this.parent.getAttribute(this.morphType);
        const morphIdValue = this.parent.getAttribute(this.morphId);

        if (morphTypeValue && morphIdValue) {
            const modelClass = this.getModelForType(String(morphTypeValue));
            if (modelClass) {
                this.query.where(this.ownerKey, "=", morphIdValue as WhereClauseValue);
            }
        }
    }

    /**
     * Get the model class for a given morph type.
     *
     * @param type - Morph type value
     * @returns Model constructor or null
     */
    getModelForType(type: string): ModelConstructor<Model> | null {
        // Check morphMap first
        if (this.morphMap[type]) {
            return this.morphMap[type];
        }

        // Fallback: try to infer from table name
        // This is a simple fallback - in production, you'd want a proper mapping
        return null;
    }

    /**
     * Get the results of the relationship.
     *
     * @returns Promise resolving to the related model or null
     */
    async getResults(): Promise<Model | null> {
        const morphTypeValue = this.parent.getAttribute(this.morphType);
        const morphIdValue = this.parent.getAttribute(this.morphId);

        if (!morphTypeValue || !morphIdValue) {
            return null;
        }

        const modelClass = this.getModelForType(String(morphTypeValue));
        if (!modelClass) {
            return null;
        }

        const instance = new modelClass();
        return instance
            .newQuery()
            .where(this.ownerKey, "=", morphIdValue as WhereClauseValue)
            .first();
    }

    /**
     * Associate the parent with a related model.
     *
     * @param model - Related model instance or null
     * @returns This relation for chaining
     */
    associate(model: Model | null): this {
        if (model === null) {
            this.parent.setAttribute(this.morphId, null);
            this.parent.setAttribute(this.morphType, null);
        } else {
            const morphIdValue = model.getAttribute(this.ownerKey) as PrimaryKey;
            this.parent.setAttribute(this.morphId, morphIdValue);
            this.parent.setAttribute(this.morphType, model.getTable());
        }

        return this;
    }

    /**
     * Dissociate the parent from any related model.
     *
     * @returns This relation for chaining
     */
    dissociate(): this {
        return this.associate(null);
    }

    /**
     * Get the foreign key value for the relationship.
     *
     * @returns Foreign key value
     */
    getForeignKeyValue(): PrimaryKey | null {
        return this.parent.getAttribute(this.morphId) as PrimaryKey | null;
    }

    /**
     * Get the morph type value for the relationship.
     *
     * @returns Morph type value
     */
    getMorphTypeValue(): string | null {
        return this.parent.getAttribute(this.morphType) as string | null;
    }
}
