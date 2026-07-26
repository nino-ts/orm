/**
 * MorphMany - Polymorphic One-to-Many Relationship.
 *
 * Handles polymorphic one-to-many relationships where a model can have
 * multiple related models through a single association.
 *
 * @packageDocumentation
 */

import { Collection } from "../collection";
import { Model } from "../model";
import type { QueryBuilder } from "../query-builder";
import { Relation } from "./relation";
import type { WhereClauseValue } from "../types";

/**
 * MorphMany relationship for polymorphic one-to-many associations.
 *
 * @template TRelated - The related model type
 * @template TParent - The parent model type
 *
 * @example
 * ```typescript
 * class Video extends Model {
 *     comments() {
 *         return this.morphMany(Comment, 'commentable');
 *     }
 * }
 *
 * class Post extends Model {
 *     comments() {
 *         return this.morphMany(Comment, 'commentable');
 *     }
 * }
 *
 * class Comment extends Model {
 *     commentable() {
 *         return this.morphTo(Commentable, 'commentable_type', 'commentable_id');
 *     }
 * }
 * ```
 */
export class MorphMany<TRelated extends Model = Model, TParent extends Model = Model> extends Relation<
    TRelated,
    TParent
> {
    /**
     * The foreign key type column name (e.g., 'commentable_type').
     */
    public morphType: string;

    /**
     * The foreign key ID column name (e.g., 'commentable_id').
     */
    public morphId: string;

    /**
     * The local key on the parent model.
     */
    public localKey: string;

    /**
     * Create a new MorphMany instance.
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
            model.setRelation(relation, new Collection<TRelated>() as unknown as Collection<Model>);
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

            const matches = results.filter((result) => {
                const morphId = result.getAttribute(this.morphId);
                const morphType = result.getAttribute(this.morphType);
                return morphId === localKeyValue && morphType === parentType;
            });

            model.setRelation(relation, matches as unknown as Collection<Model>);
        }

        return models;
    }

    /**
     * Get the results of the relationship.
     *
     * @returns Promise resolving to a Collection of related models
     */
    async getResults(): Promise<Collection<TRelated>> {
        return this.get();
    }

    /**
     * Create a new related model instance associated with this parent.
     *
     * @param attributes - Attributes for the new related model
     * @returns The created related model
     */
    async create(attributes: Partial<Record<string, unknown>>): Promise<TRelated> {
        const related = new Model() as TRelated;
        related.fill(attributes);

        // Set morph attributes
        const localKeyValue = this.parent.getAttribute(this.localKey);
        const parentType = this.parent.getTable();

        related.setAttribute(this.morphId, localKeyValue);
        related.setAttribute(this.morphType, parentType);

        await related.save();
        return related;
    }

    /**
     * Get the results of the relationship.
     *
     * @returns Promise resolving to a Collection of related models
     */
    override async get(): Promise<Collection<TRelated>> {
        const results = await this.query.get();
        return results as unknown as Collection<TRelated>;
    }
}
