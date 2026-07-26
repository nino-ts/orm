/**
 * MorphToMany - Polymorphic Many-to-Many Relationship.
 *
 * Handles polymorphic many-to-many relationships where a model can belong to
 * multiple models of different types through a pivot table.
 *
 * @packageDocumentation
 */

import { Collection } from "../collection";
import type { Model } from "../model";
import { QueryBuilder } from "../query-builder";
import { Relation } from "./relation";
import type { PrimaryKey, WhereClauseValue } from "../types";

/**
 * MorphToMany relationship for polymorphic many-to-many associations.
 *
 * @template TRelated - The related model type
 * @template TParent - The parent model type
 *
 * @example
 * ```typescript
 * class Post extends Model {
 *     tags() {
 *         return this.morphToMany(Tag, 'taggable', 'taggables');
 *     }
 * }
 *
 * class Video extends Model {
 *     tags() {
 *         return this.morphToMany(Tag, 'taggable', 'taggables');
 *     }
 * }
 *
 * class Tag extends Model {
 *     posts() {
 *         return this.morphedByMany(Post, 'taggable', 'taggables');
 *     }
 * }
 * ```
 */
export class MorphToMany<TRelated extends Model = Model, TParent extends Model = Model> extends Relation<
    TRelated,
    TParent
> {
    /**
     * The pivot table name.
     */
    public table: string;

    /**
     * The foreign key type column name on pivot (e.g., 'taggable_type').
     */
    public morphType: string;

    /**
     * The foreign key ID column name on pivot (e.g., 'taggable_id').
     */
    public morphId: string;

    /**
     * The related key on the pivot table.
     */
    public relatedId: string;

    /**
     * The local key on the parent model.
     */
    public parentKey: string;

    /**
     * The related key on the related model.
     */
    public relatedKey: string;

    /**
     * Whether this is the inverse (morphedByMany) relation.
     */
    public inverse: boolean;

    /**
     * Create a new MorphToMany instance.
     *
     * @param query - QueryBuilder instance
     * @param parent - Parent model instance
     * @param table - Pivot table name
     * @param morphType - Morph type column name
     * @param morphId - Morph ID column name
     * @param relatedId - Related ID column name on pivot
     * @param parentKey - Parent key
     * @param relatedKey - Related key
     * @param inverse - Whether this is inverse relation
     */
    constructor(
        query: QueryBuilder<TRelated>,
        parent: TParent,
        table: string,
        morphType: string,
        morphId: string,
        relatedId: string,
        parentKey: string,
        relatedKey: string,
        inverse: boolean = false,
    ) {
        super(query, parent);
        this.table = table;
        this.morphType = morphType;
        this.morphId = morphId;
        this.relatedId = relatedId;
        this.parentKey = parentKey;
        this.relatedKey = relatedKey;
        this.inverse = inverse;
        this.addConstraints();
    }

    /**
     * Add the constraints for the relationship query.
     */
    addConstraints(): void {
        const parentKeyValue = this.parent.getAttribute(this.parentKey);
        const parentType = this.parent.getTable();

        if (parentKeyValue) {
            this.query
                .join(this.table, `${this.query.fromTable}.${this.relatedKey}`, "=", `${this.table}.${this.relatedId}`)
                .where(`${this.table}.${this.morphId}`, "=", parentKeyValue as WhereClauseValue)
                .where(`${this.table}.${this.morphType}`, "=", parentType);
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
            .map((m) => m.getAttribute(this.parentKey) as WhereClauseValue)
            .filter((key): key is NonNullable<WhereClauseValue> => key !== null && key !== undefined);

        const parentType = models[0]?.getTable() ?? "";

        if (keys.length > 0) {
            this.query
                .join(this.table, `${this.query.fromTable}.${this.relatedKey}`, "=", `${this.table}.${this.relatedId}`)
                .whereIn(`${this.table}.${this.morphId}`, keys)
                .where(`${this.table}.${this.morphType}`, "=", parentType);
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
            // Get related models for this parent
            const related = results.filter(() => {
                // This would need pivot table data to properly match
                // Simplified for now
                return true;
            });

            model.setRelation(relation, related as unknown as Collection<Model>);
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
     * Attach a model to the relationship.
     *
     * @param id - Related model ID
     * @param attributes - Additional pivot attributes
     * @returns Promise of execution result
     */
    async attach(id: WhereClauseValue, attributes: Record<string, unknown> = {}): Promise<void> {
        const parentKeyValue = this.parent.getAttribute(this.parentKey) as WhereClauseValue;
        const parentType = this.parent.getTable();

        const pivotData: Record<string, unknown> = {
            [this.morphId]: parentKeyValue,
            [this.morphType]: parentType,
            [this.relatedId]: id,
            ...attributes,
        };

        // Insert into pivot table
        const connection = this.query.connection;
        const grammar = (
            this.query as unknown as {
                grammar: {
                    compileInsert: (qb: QueryBuilder, values: object) => string;
                };
            }
        ).grammar;

        const sql = grammar.compileInsert(new QueryBuilder(connection), pivotData);
        const bindings = Object.values(pivotData).filter((v): v is NonNullable<unknown> => v != null);

        await connection.run(sql, bindings as WhereClauseValue[]);
    }

    /**
     * Detach a model from the relationship.
     *
     * @param id - Related model ID (optional, detaches all if not provided)
     * @returns Number of detached records
     */
    async detach(id?: WhereClauseValue): Promise<number> {
        const parentKeyValue = this.parent.getAttribute(this.parentKey) as WhereClauseValue;
        const parentType = this.parent.getTable();

        const query = new QueryBuilder(this.query.connection)
            .from(this.table)
            .where(this.morphId, "=", parentKeyValue)
            .where(this.morphType, "=", parentType);

        if (id !== undefined) {
            query.where(this.relatedId, "=", id);
        }

        const result = await query.delete();
        return result.changes ?? result.affectedRows ?? 0;
    }

    /**
     * Sync the relationship with the given IDs.
     *
     * @param ids - Array or object of IDs to sync
     * @param detaching - Whether to detach missing IDs
     * @returns Object with attached, detached, and updated IDs
     */
    async sync(
        ids: WhereClauseValue[] | Record<string, unknown>,
        detaching = true,
    ): Promise<{
        attached: WhereClauseValue[];
        detached: WhereClauseValue[];
        updated: WhereClauseValue[];
    }> {
        // Simplified implementation
        const idArray = Array.isArray(ids) ? ids : Object.keys(ids).map((k) => k as unknown as WhereClauseValue);
        const attached: WhereClauseValue[] = [];
        const detached: WhereClauseValue[] = [];
        const updated: WhereClauseValue[] = [];

        // Get current IDs
        const current = await this.get();
        const currentIds = current
            .all()
            .map((item: TRelated): PrimaryKey => item.getAttribute(this.relatedKey) as PrimaryKey);

        // Detach missing
        if (detaching) {
            const toDetach = currentIds.filter((id: PrimaryKey) => !idArray.includes(id as WhereClauseValue));
            for (const id of toDetach) {
                await this.detach(id as WhereClauseValue);
                detached.push(id as WhereClauseValue);
            }
        }

        // Attach new
        for (const id of idArray) {
            if (!currentIds.includes(id as PrimaryKey)) {
                const attributes = Array.isArray(ids) ? {} : ids[String(id)];
                await this.attach(id, attributes as Record<string, unknown>);
                attached.push(id);
            }
        }

        return { attached, detached, updated };
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
