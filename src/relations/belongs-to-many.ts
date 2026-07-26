import type { Model } from "../model";
import type { QueryBuilder } from "../query-builder";
import { Relation } from "./relation";
import type { WhereClauseValue } from "../types";

/**
 * BelongsToMany relation for many-to-many relationships via pivot table.
 *
 * @template TRelated - The related model type
 * @template TParent - The parent model type
 *
 * @example
 * ```typescript
 * class User extends Model {
 *     roles() {
 *         return this.belongsToMany(
 *             Role,
 *             'user_roles',
 *             'user_id',
 *             'role_id',
 *             'id',
 *             'id'
 *         );
 *     }
 * }
 *
 * const roles = await user.roles().get();
 * ```
 */
export class BelongsToMany<TRelated extends Model = Model, TParent extends Model = Model> extends Relation<
    TRelated,
    TParent
> {
    /**
     * Create a new BelongsToMany instance.
     *
     * @param query - QueryBuilder instance
     * @param parent - Parent model instance
     * @param table - Pivot table name
     * @param foreignPivotKey - Foreign key for the parent model on the pivot table
     * @param relatedPivotKey - Foreign key for the related model on the pivot table
     * @param parentKey - Key on the parent model
     * @param relatedKey - Key on the related model
     */
    constructor(
        query: QueryBuilder<TRelated>,
        parent: TParent,
        public table: string,
        public foreignPivotKey: string,
        public relatedPivotKey: string,
        public parentKey: string,
        public relatedKey: string,
    ) {
        super(query, parent);
        this.addConstraints();
    }

    /**
     * Add the base constraints for the relation query.
     */
    addConstraints(): void {
        const parentKeyValue = this.parent.getAttribute(this.parentKey);
        if (parentKeyValue) {
            // Join pivot table and filter
            this.query
                .join(
                    this.table,
                    `${this.getRelatedTable()}.${this.relatedKey}`,
                    "=",
                    `${this.table}.${this.relatedPivotKey}`,
                )
                .where(`${this.table}.${this.foreignPivotKey}`, "=", parentKeyValue as WhereClauseValue);
        }
    }

    /**
     * Get the related table name.
     *
     * @returns Table name from the query
     */
    protected getRelatedTable(): string {
        // Get table from the query's fromTable
        return this.query.fromTable;
    }
}
