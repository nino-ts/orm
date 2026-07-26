/**
 * MorphOne - Polymorphic One-to-One Relationship.
 *
 * Handles polymorphic one-to-one relationships where a model can belong to
 * multiple different models through a single association.
 *
 * @packageDocumentation
 */

import type { Collection } from "../collection";
import type { Model } from "../model";
import type { QueryBuilder } from "../query-builder";
import { Relation } from "./relation";
import type { WhereClauseValue } from "../types";

/**
 * MorphOne relationship for polymorphic one-to-one associations.
 *
 * @template TRelated - The related model type
 * @template TParent - The parent model type
 *
 * @example
 * ```typescript
 * class Image extends Model {
 *     imageable() {
 *         return this.morphTo(Imageable, 'imageable_type', 'imageable_id');
 *     }
 * }
 *
 * class User extends Model {
 *     avatar() {
 *         return this.morphOne(Image, 'imageable');
 *     }
 * }
 * ```
 */
export class MorphOne<TRelated extends Model = Model, TParent extends Model = Model> extends Relation<
    TRelated,
    TParent
> {
    /**
     * The foreign key type column name (e.g., 'imageable_type').
     */
    public morphType: string;

    /**
     * The foreign key ID column name (e.g., 'imageable_id').
     */
    public morphId: string;

    /**
     * The local key on the parent model.
     */
    public localKey: string;

    /**
     * Create a new MorphOne instance.
     *
     * @param query - QueryBuilder instance
     * @param parent - Parent model instance
     * @param morphType - Morph type column name
     * @param morphId - Morph ID column name
     * @param localKey - Local key on parent model
     */
    constructor(query: QueryBuilder<TRelated>, parent: TParent, morphType: string, morphId: string, localKey: string) {
        super(query, parent);
        this.morphType = morphType;
        this.morphId = morphId;
        this.localKey = localKey;
        this.addConstraints();
    }

    /**
     * Add the constraints for the relationship query.
     */
    addConstraints(): void {
        const localKeyValue = this.parent.getAttribute(this.localKey);
        const parentType = this.parent.getTable();

        if (localKeyValue) {
            this.query
                .where(this.morphId, "=", localKeyValue as WhereClauseValue)
                .where(this.morphType, "=", parentType);
        }
    }

    /**
     * Add the constraints for eager loading.
     *
     * @param models - Array of parent models
     * @returns QueryBuilder for eager loading
     */
    addEagerConstraints(models: Model[]): QueryBuilder<TRelated> {
        const keys = models
            .map((m) => m.getAttribute(this.localKey) as WhereClauseValue)
            .filter((key): key is NonNullable<WhereClauseValue> => key !== null && key !== undefined);

        const parentType = models[0]?.getTable() ?? "";

        if (keys.length > 0) {
            this.query.whereIn(this.morphId, keys).where(this.morphType, "=", parentType);
        }

        return this.query;
    }

    /**
     * Initialize the relation on an array of parent models.
     *
     * @param models - Parent models
     * @param relation - Relation name
     * @returns Array of parent models with relations set
     */
    initRelation(models: Model[], relation: string): Model[] {
        for (const model of models) {
            model.setRelation(relation, null);
        }
        return models;
    }

    /**
     * Match the eagerly loaded results to their parent models.
     *
     * @param models - Parent models
     * @param results - Related models from eager load
     * @param relation - Relation name
     * @returns Array of parent models with relations matched
     */
    match(models: Model[], results: Collection<TRelated>, relation: string): Model[] {
        for (const model of models) {
            const localKeyValue = model.getAttribute(this.localKey);
            const parentType = model.getTable();

            const match = results.all().find((result) => {
                const morphId = result.getAttribute(this.morphId);
                const morphType = result.getAttribute(this.morphType);
                return morphId === localKeyValue && morphType === parentType;
            });

            model.setRelation(relation, match ?? null);
        }

        return models;
    }

    /**
     * Get the results of the relationship.
     *
     * @returns Promise resolving to the related model or null
     */
    async getResults(): Promise<TRelated | null> {
        return this.first();
    }
}
