/**
 * Query Builder - Enhanced with Advanced Where Clauses, Grouping, and More.
 *
 * Extended QueryBuilder class with comprehensive SQL building capabilities
 * including between clauses, date filters, column comparisons, grouping,
 * and exists checks.
 *
 * @packageDocumentation
 */

import { Collection } from "./collection";
import { QueryException } from "./exceptions";
import { Grammar } from "./grammar";
import type {
    BooleanOperator,
    DatabaseRow,
    JoinClause,
    ModelConstructor,
    ModelInstance,
    MutationValues,
    Operator,
    OrderClause,
    PaginationResult,
    StatementExecutionResult,
    WhereClause,
    WhereClauseValue,
} from "./types";

/**
 * Interface that represents a database connector capable of running queries.
 */
export interface Connector {
    /**
     * Execute a SELECT query and return the results.
     *
     * @template T - The type of rows returned
     * @param sql - The SQL query string
     * @param bindings - Array of parameter bindings
     * @returns Promise of result rows
     */
    query<T = DatabaseRow>(sql: string, bindings: readonly WhereClauseValue[]): Promise<T[]>;

    /**
     * Execute an INSERT, UPDATE, or DELETE query.
     *
     * @param sql - The SQL query string
     * @param bindings - Array of parameter bindings
     * @returns Promise of execution result
     */
    run(sql: string, bindings: readonly WhereClauseValue[]): Promise<StatementExecutionResult>;
}

/**
 * The QueryBuilder class is responsible for building and executing database queries
 * programmatically using a fluent interface.
 *
 * @template TModel - The model type (defaults to DatabaseRow)
 *
 * @example
 * ```typescript
 * const users = await new QueryBuilder<User>(connection)
 *     .table('users')
 *     .where('age', '>', 18)
 *     .orderBy('name', 'asc')
 *     .get();
 * ```
 */
export class QueryBuilder<TModel extends ModelInstance = ModelInstance> {
    /**
     * Columns to select.
     */
    public columns: string[] = [];

    /**
     * Table to query from.
     */
    public fromTable: string = "";

    /**
     * WHERE clauses.
     */
    public wheres: WhereClause[] = [];

    /**
     * ORDER BY clauses.
     */
    public orders: OrderClause[] = [];

    /**
     * LIMIT value.
     */
    public limitValue?: number;

    /**
     * OFFSET value.
     */
    public offsetValue?: number;

    /**
     * JOIN clauses.
     */
    public joins: JoinClause[] = [];

    /**
     * Query parameter bindings.
     */
    public bindings: WhereClauseValue[] = [];

    /**
     * Relations to eager load.
     */
    public eagerRelations: string[] = [];

    /**
     * Model class for hydration.
     */
    protected modelClass?: ModelConstructor<TModel>;

    /**
     * SQL grammar instance.
     */
    protected readonly grammar: Grammar;

    /**
     * Database connection.
     */
    public readonly connection: Connector;

    /**
     * GROUP BY columns.
     */
    public groups: string[] = [];

    /**
     * HAVING clauses.
     */
    public havings: Array<{
        type: "Basic" | "Null";
        column?: string;
        operator?: Operator;
        value?: WhereClauseValue;
        boolean: BooleanOperator;
    }> = [];

    /**
     * Whether to use DISTINCT.
     */
    public useDistinct: boolean = false;

    /**
     * Creates a new QueryBuilder instance.
     *
     * @param connection - Database connector
     * @param grammar - SQL grammar (defaults to generic Grammar)
     */
    constructor(connection: Connector, grammar?: Grammar) {
        this.connection = connection;
        this.grammar = grammar ?? new Grammar();
    }

    /**
     * Set the columns to be selected.
     *
     * @param columns - List of column names
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.select('id', 'name', 'email');
     * ```
     */
    select(...columns: readonly string[]): this {
        this.columns = [...columns];
        return this;
    }

    /**
     * Add a new column to be selected.
     *
     * @param column - Column name
     * @returns This query builder for chaining
     */
    addSelect(column: string): this {
        this.columns.push(column);
        return this;
    }

    /**
     * Set the table to query from.
     *
     * @param table - Name of the table
     * @returns This query builder for chaining
     */
    table(table: string): this {
        this.fromTable = table;
        return this;
    }

    /**
     * Alias for table().
     *
     * @param table - Name of the table
     * @returns This query builder for chaining
     */
    from(table: string): this {
        return this.table(table);
    }

    /**
     * Add a basic WHERE clause to the query.
     *
     * Supports multiple signatures:
     * - where('column', 'value') - implicit '=' operator
     * - where('column', '>', 'value') - explicit operator
     * - where({ col: 'val', col2: 'val2' }) - object syntax
     *
     * @param column - Column name or object of key-value pairs
     * @param operator - Operator (e.g., '=', '>', '<') or value (if implicit '=')
     * @param value - Value to compare against
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.where('age', '>', 18);
     * builder.where('status', 'active');
     * builder.where({ age: 18, active: true });
     * ```
     */
    where(
        column: string | Record<string, WhereClauseValue>,
        operator?: Operator | WhereClauseValue,
        value?: WhereClauseValue,
        boolean: BooleanOperator = "and",
    ): this {
        if (typeof column === "object") {
            // Handle object syntax
            for (const [key, val] of Object.entries(column)) {
                this.where(key, "=", val, boolean);
            }
            return this;
        }

        const resolvedOperator = value === undefined ? "=" : (operator as Operator);
        const resolvedValue = value === undefined ? (operator as WhereClauseValue) : value;

        this.wheres.push({
            boolean,
            column,
            operator: resolvedOperator,
            type: "Basic",
            value: resolvedValue,
        });
        this.bindings.push(resolvedValue);

        return this;
    }

    /**
     * Add an OR WHERE clause to the query.
     *
     * @param column - Column name
     * @param operator - Operator or value
     * @param value - Value (optional)
     * @returns This query builder for chaining
     */
    orWhere(column: string, operator?: Operator | WhereClauseValue, value?: WhereClauseValue): this {
        return this.where(column, operator, value, "or");
    }

    /**
     * Add a WHERE NULL clause to the query.
     *
     * @param column - Column name
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     */
    whereNull(column: string, boolean: BooleanOperator = "and"): this {
        this.wheres.push({ boolean, column, type: "Null" });
        return this;
    }

    /**
     * Add a WHERE NOT NULL clause to the query.
     *
     * @param column - Column name
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     */
    whereNotNull(column: string, boolean: BooleanOperator = "and"): this {
        this.wheres.push({ boolean, column, not: true, type: "Null" });
        return this;
    }

    /**
     * Add an OR WHERE NULL clause to the query.
     *
     * @param column - Column name
     * @returns This query builder for chaining
     */
    orWhereNull(column: string): this {
        return this.whereNull(column, "or");
    }

    /**
     * Add an OR WHERE NOT NULL clause to the query.
     *
     * @param column - Column name
     * @returns This query builder for chaining
     */
    orWhereNotNull(column: string): this {
        return this.whereNotNull(column, "or");
    }

    /**
     * Add a WHERE IN clause to the query.
     *
     * @param column - Column name
     * @param values - Array of values
     * @param boolean - Boolean operator ('and' or 'or')
     * @param not - Whether this is a NOT IN clause
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.whereIn('status', ['active', 'pending']);
     * ```
     */
    whereIn(
        column: string,
        values: readonly WhereClauseValue[],
        boolean: BooleanOperator = "and",
        not: boolean = false,
    ): this {
        this.wheres.push({ boolean, column, not, type: "In", values });
        this.bindings.push(...values);
        return this;
    }

    /**
     * Add a WHERE NOT IN clause to the query.
     *
     * @param column - Column name
     * @param values - Array of values
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     */
    whereNotIn(column: string, values: readonly WhereClauseValue[], boolean: BooleanOperator = "and"): this {
        return this.whereIn(column, values, boolean, true);
    }

    /**
     * Add an OR WHERE IN clause to the query.
     *
     * @param column - Column name
     * @param values - Array of values
     * @returns This query builder for chaining
     */
    orWhereIn(column: string, values: readonly WhereClauseValue[]): this {
        return this.whereIn(column, values, "or");
    }

    /**
     * Add an OR WHERE NOT IN clause to the query.
     *
     * @param column - Column name
     * @param values - Array of values
     * @returns This query builder for chaining
     */
    orWhereNotIn(column: string, values: readonly WhereClauseValue[]): this {
        return this.whereNotIn(column, values, "or");
    }

    /**
     * Add a WHERE BETWEEN clause to the query.
     *
     * @param column - Column name
     * @param min - Minimum value
     * @param max - Maximum value
     * @param boolean - Boolean operator ('and' or 'or')
     * @param not - Whether this is a NOT BETWEEN clause
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.whereBetween('age', 18, 65);
     * ```
     */
    whereBetween(
        column: string,
        min: WhereClauseValue,
        max: WhereClauseValue,
        boolean: BooleanOperator = "and",
        not: boolean = false,
    ): this {
        this.wheres.push({
            boolean,
            column,
            max,
            min,
            not,
            type: "Between",
        });
        this.bindings.push(min, max);
        return this;
    }

    /**
     * Add a WHERE NOT BETWEEN clause to the query.
     *
     * @param column - Column name
     * @param min - Minimum value
     * @param max - Maximum value
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     */
    whereNotBetween(
        column: string,
        min: WhereClauseValue,
        max: WhereClauseValue,
        boolean: BooleanOperator = "and",
    ): this {
        return this.whereBetween(column, min, max, boolean, true);
    }

    /**
     * Add an OR WHERE BETWEEN clause to the query.
     *
     * @param column - Column name
     * @param min - Minimum value
     * @param max - Maximum value
     * @returns This query builder for chaining
     */
    orWhereBetween(column: string, min: WhereClauseValue, max: WhereClauseValue): this {
        return this.whereBetween(column, min, max, "or");
    }

    /**
     * Add an OR WHERE NOT BETWEEN clause to the query.
     *
     * @param column - Column name
     * @param min - Minimum value
     * @param max - Maximum value
     * @returns This query builder for chaining
     */
    orWhereNotBetween(column: string, min: WhereClauseValue, max: WhereClauseValue): this {
        return this.whereNotBetween(column, min, max, "or");
    }

    /**
     * Add a WHERE DATE clause to the query.
     *
     * @param column - Column name
     * @param operator - Operator
     * @param value - Date value
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.whereDate('created_at', '=', '2024-01-15');
     * ```
     */
    whereDate(
        column: string,
        operator: Operator | WhereClauseValue,
        value?: WhereClauseValue,
        boolean: BooleanOperator = "and",
    ): this {
        const resolvedOperator = value === undefined ? "=" : (operator as Operator);
        const resolvedValue = value === undefined ? (operator as WhereClauseValue) : value;

        this.wheres.push({
            boolean,
            column,
            operator: resolvedOperator,
            type: "Basic",
            value: resolvedValue,
        });
        this.bindings.push(resolvedValue);
        return this;
    }

    /**
     * Add a WHERE YEAR clause to the query.
     *
     * @param column - Column name
     * @param operator - Operator
     * @param value - Year value
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     */
    whereYear(
        column: string,
        operator: Operator | WhereClauseValue,
        value?: WhereClauseValue,
        boolean: BooleanOperator = "and",
    ): this {
        return this.whereDate(column, operator, value, boolean);
    }

    /**
     * Add a WHERE MONTH clause to the query.
     *
     * @param column - Column name
     * @param operator - Operator
     * @param value - Month value
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     */
    whereMonth(
        column: string,
        operator: Operator | WhereClauseValue,
        value?: WhereClauseValue,
        boolean: BooleanOperator = "and",
    ): this {
        return this.whereDate(column, operator, value, boolean);
    }

    /**
     * Add a WHERE DAY clause to the query.
     *
     * @param column - Column name
     * @param operator - Operator
     * @param value - Day value
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     */
    whereDay(
        column: string,
        operator: Operator | WhereClauseValue,
        value?: WhereClauseValue,
        boolean: BooleanOperator = "and",
    ): this {
        return this.whereDate(column, operator, value, boolean);
    }

    /**
     * Add a WHERE COLUMN clause to the query (column to column comparison).
     *
     * @param first - First column name
     * @param operator - Operator
     * @param second - Second column name
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.whereColumn('users.created_at', '=', 'posts.published_at');
     * ```
     */
    whereColumn(first: string, operator: Operator, second: string, boolean: BooleanOperator = "and"): this {
        this.wheres.push({
            boolean,
            first,
            operator,
            second,
            type: "Column",
        });
        return this;
    }

    /**
     * Add an OR WHERE COLUMN clause to the query.
     *
     * @param first - First column name
     * @param operator - Operator
     * @param second - Second column name
     * @returns This query builder for chaining
     */
    orWhereColumn(first: string, operator: Operator, second: string): this {
        return this.whereColumn(first, operator, second, "or");
    }

    /**
     * Add a WHERE EXISTS clause to the query.
     *
     * @param callback - Callback that builds the subquery
     * @param boolean - Boolean operator ('and' or 'or')
     * @param not - Whether this is a NOT EXISTS clause
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.whereExists((query) => {
     *     query.select('id').from('posts').whereColumn('users.id', '=', 'posts.user_id');
     * });
     * ```
     */
    whereExists(
        callback: (query: QueryBuilder<TModel>) => void,
        boolean: BooleanOperator = "and",
        not: boolean = false,
    ): this {
        // Create subquery
        const subQuery = new QueryBuilder<TModel>(this.connection, this.grammar);
        callback(subQuery);

        // Add EXISTS clause
        this.wheres.push({
            boolean,
            column: not ? "not exists" : "exists",
            operator: "=",
            type: "Basic",
            value: subQuery.toSql(),
        });

        // Add subquery bindings
        this.bindings.push(...subQuery.bindings);

        return this;
    }

    /**
     * Add a WHERE NOT EXISTS clause to the query.
     *
     * @param callback - Callback that builds the subquery
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     */
    whereNotExists(callback: (query: QueryBuilder<TModel>) => void, boolean: BooleanOperator = "and"): this {
        return this.whereExists(callback, boolean, true);
    }

    /**
     * Add an OR WHERE EXISTS clause to the query.
     *
     * @param callback - Callback that builds the subquery
     * @returns This query builder for chaining
     */
    orWhereExists(callback: (query: QueryBuilder<TModel>) => void): this {
        return this.whereExists(callback, "or");
    }

    /**
     * Add an OR WHERE NOT EXISTS clause to the query.
     *
     * @param callback - Callback that builds the subquery
     * @returns This query builder for chaining
     */
    orWhereNotExists(callback: (query: QueryBuilder<TModel>) => void): this {
        return this.whereNotExists(callback, "or");
    }

    /**
     * Add an ORDER BY clause to the query.
     *
     * @param column - Column name
     * @param direction - Sort direction ('asc' or 'desc')
     * @returns This query builder for chaining
     */
    orderBy(column: string, direction: "asc" | "desc" = "asc"): this {
        this.orders.push({ column, direction });
        return this;
    }

    /**
     * Add an ORDER BY DESC clause to the query.
     *
     * @param column - Column name
     * @returns This query builder for chaining
     */
    orderByDesc(column: string): this {
        return this.orderBy(column, "desc");
    }

    /**
     * Set the limit for the query results.
     *
     * @param value - Number of records to return
     * @returns This query builder for chaining
     */
    limit(value: number): this {
        this.limitValue = value;
        return this;
    }

    /**
     * Set the offset for the query results.
     *
     * @param value - Number of records to skip
     * @returns This query builder for chaining
     */
    offset(value: number): this {
        this.offsetValue = value;
        return this;
    }

    /**
     * Add a JOIN clause to the query.
     *
     * @param table - Table to join
     * @param first - Column on the first table
     * @param operator - Operator
     * @param second - Column on the second table
     * @param type - Join type ('inner', 'left', etc.)
     * @returns This query builder for chaining
     */
    join(
        table: string,
        first: string,
        operator: string,
        second: string,
        type: "inner" | "left" | "right" | "cross" = "inner",
    ): this {
        this.joins.push({ first, operator, second, table, type });
        return this;
    }

    /**
     * Add a LEFT JOIN clause to the query.
     *
     * @param table - Table to join
     * @param first - Column on the first table
     * @param operator - Operator
     * @param second - Column on the second table
     * @returns This query builder for chaining
     */
    leftJoin(table: string, first: string, operator: string, second: string): this {
        return this.join(table, first, operator, second, "left");
    }

    /**
     * Add a RIGHT JOIN clause to the query.
     *
     * @param table - Table to join
     * @param first - Column on the first table
     * @param operator - Operator
     * @param second - Column on the second table
     * @returns This query builder for chaining
     */
    rightJoin(table: string, first: string, operator: string, second: string): this {
        return this.join(table, first, operator, second, "right");
    }

    /**
     * Add a CROSS JOIN clause to the query.
     *
     * @param table - Table to join
     * @returns This query builder for chaining
     */
    crossJoin(table: string): this {
        this.joins.push({
            first: "",
            operator: "",
            second: "",
            table,
            type: "cross",
        });
        return this;
    }

    /**
     * Set the GROUP BY clause.
     *
     * @param columns - Columns to group by
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.groupBy('department');
     * builder.groupBy('department', 'role');
     * ```
     */
    groupBy(...columns: readonly string[]): this {
        this.groups.push(...columns);
        return this;
    }

    /**
     * Add a HAVING clause to the query.
     *
     * @param column - Column name
     * @param operator - Operator
     * @param value - Value to compare against
     * @param boolean - Boolean operator ('and' or 'or')
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.having('count', '>', 5);
     * ```
     */
    having(
        column: string,
        operator?: Operator | WhereClauseValue,
        value?: WhereClauseValue,
        boolean: BooleanOperator = "and",
    ): this {
        const resolvedOperator = value === undefined ? "=" : (operator as Operator);
        const resolvedValue = value === undefined ? (operator as WhereClauseValue) : value;

        this.havings.push({
            boolean,
            column,
            operator: resolvedOperator,
            type: "Basic",
            value: resolvedValue,
        });
        this.bindings.push(resolvedValue);

        return this;
    }

    /**
     * Add an OR HAVING clause to the query.
     *
     * @param column - Column name
     * @param operator - Operator or value
     * @param value - Value (optional)
     * @returns This query builder for chaining
     */
    orHaving(column: string, operator?: Operator | WhereClauseValue, value?: WhereClauseValue): this {
        return this.having(column, operator, value, "or");
    }

    /**
     * Set DISTINCT on the query.
     *
     * @param value - Whether to use distinct (default: true)
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * builder.distinct();
     * builder.distinct(true);
     * ```
     */
    distinct(value: boolean = true): this {
        this.useDistinct = value;
        return this;
    }

    /**
     * Apply a callback to the query when a given condition is truthy.
     *
     * @template V - The type of the condition value
     * @param condition - The condition to evaluate
     * @param callback - Callback to apply when condition is truthy
     * @param fallback - Optional callback when condition is falsy
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * const users = await User.query()
     *   .when(searchTerm, (q, term) => q.where('name', 'like', `%${term}%`))
     *   .when(isAdmin, (q) => q.where('role', 'admin'))
     *   .get();
     * ```
     */
    when<V>(
        condition: V | null | undefined | false | 0 | "",
        callback: (builder: this, value: NonNullable<V>) => this,
        fallback?: (builder: this) => this,
    ): this {
        if (condition) {
            return callback(this, condition as NonNullable<V>);
        }
        return fallback ? fallback(this) : this;
    }

    /**
     * Apply a callback to the query when a given condition is falsy.
     * Inverse of `when()`.
     *
     * @template V - The type of the condition value
     * @param condition - The condition to evaluate
     * @param callback - Callback to apply when condition is falsy
     * @param fallback - Optional callback when condition is truthy
     * @returns This query builder for chaining
     */
    unless<V>(
        condition: V | null | undefined | false | 0 | "",
        callback: (builder: this) => this,
        fallback?: (builder: this) => this,
    ): this {
        if (!condition) {
            return callback(this);
        }
        return fallback ? fallback(this) : this;
    }

    /**
     * Compile the current query into SQL.
     *
     * @returns SQL query string
     */
    toSql(): string {
        return this.grammar.compileSelect(this);
    }

    /**
     * Get the current query bindings.
     *
     * @returns Array of query bindings
     */
    getBindings(): readonly WhereClauseValue[] {
        return Object.freeze([...this.bindings]);
    }

    /**
     * Execute the query and return a Collection of results.
     *
     * @template T - The type of items to return (defaults to TModel)
     * @returns Promise of Collection with results
     *
     * @example
     * ```typescript
     * const users = await builder.get<User>();
     * ```
     */
    async get<T extends ModelInstance = TModel>(): Promise<Collection<T>> {
        const sql = this.toSql();
        const bindings = [...this.bindings];

        try {
            const results = await this.connection.query<DatabaseRow>(sql, bindings);

            // Hydrate models if we have a model class
            let items: T[];
            if (this.modelClass) {
                items = results.map((row: DatabaseRow): T => {
                    if (!this.modelClass) {
                        throw new Error("Model class is not defined during hydration");
                    }
                    const model = new this.modelClass() as unknown as T;
                    model.fill(row);
                    model.exists = true;
                    return model;
                });
            } else {
                items = results as unknown as T[];
            }

            const collection = new Collection<T>(items);

            // Eager load relations
            if (this.eagerRelations.length > 0 && this.modelClass) {
                await this.eagerLoadRelations(collection);
            }

            return collection;
        } catch (error) {
            if (error instanceof Error) {
                throw new QueryException(error.message, sql, bindings);
            }
            throw new QueryException("Unknown query error", sql, bindings);
        }
    }

    /**
     * Set the model class for hydration.
     *
     * @param model - Model constructor
     * @returns This query builder for chaining
     */
    setModel(model: ModelConstructor<TModel>): this {
        this.modelClass = model;
        return this;
    }

    /**
     * Set relations to eager load.
     *
     * @param relations - Relation names
     * @returns This query builder for chaining
     *
     * @example
     * ```typescript
     * const users = await User.query().with('posts', 'comments').get();
     * ```
     */
    with(...relations: readonly string[]): this {
        this.eagerRelations.push(...relations);
        return this;
    }

    /**
     * Eager load relations on a collection of models.
     *
     * @template T - Model type
     * @param collection - Collection of models
     */
    protected async eagerLoadRelations<T extends ModelInstance>(collection: Collection<T>): Promise<void> {
        for (const relationName of this.eagerRelations) {
            const models = collection.all();
            if (models.length === 0) {
                continue;
            }

            // Get the first model to access the relation definition
            const firstModel = models[0];
            if (!firstModel) {
                continue;
            }

            // Check if relation method exists
            const relationMethod = (firstModel as Record<string, unknown>)[relationName];
            if (typeof relationMethod !== "function") {
                continue;
            }

            // Get relation instance
            const relation = relationMethod.call(firstModel) as {
                constructor: { name: string };
                foreignKey: string;
                ownerKey: string;
                getBaseQuery: () => QueryBuilder;
            };
            const relationType = relation.constructor.name;

            if (relationType === "HasMany") {
                // Collect parent IDs
                const parentIds = models
                    .map((m: T): WhereClauseValue => (m as Record<string, unknown>).id as WhereClauseValue)
                    .filter((id): id is NonNullable<WhereClauseValue> => id !== null && id !== undefined);

                if (parentIds.length === 0) {
                    continue;
                }

                // Fetch all related models
                const relatedModels = await relation.getBaseQuery().whereIn(relation.foreignKey, parentIds).get();

                // Group by foreign key and assign
                for (const model of models) {
                    const related = relatedModels.filter((r: ModelInstance): boolean => {
                        const fkValue = (r as Record<string, unknown>)[relation.foreignKey];
                        const modelId = (model as Record<string, unknown>).id;
                        return fkValue === modelId;
                    });
                    if ("setRelation" in model && typeof model.setRelation === "function") {
                        model.setRelation(relationName, new Collection([...related]));
                    }
                }
            } else if (relationType === "BelongsTo") {
                // Collect foreign key values
                const foreignKeyValues = models
                    .map(
                        (m: T): WhereClauseValue =>
                            (m as Record<string, unknown>)[relation.foreignKey] as WhereClauseValue,
                    )
                    .filter((val): val is NonNullable<WhereClauseValue> => val !== null && val !== undefined);

                if (foreignKeyValues.length === 0) {
                    continue;
                }

                // Fetch all parent models
                const parentModels = await relation.getBaseQuery().whereIn(relation.ownerKey, foreignKeyValues).get();

                // Assign to each model
                for (const model of models) {
                    const fkValue = (model as Record<string, unknown>)[relation.foreignKey];
                    const parent = parentModels.all().find((p: ModelInstance): boolean => {
                        const ownerValue = (p as Record<string, unknown>)[relation.ownerKey];
                        return ownerValue === fkValue;
                    });
                    if ("setRelation" in model && typeof model.setRelation === "function") {
                        model.setRelation(relationName, parent ?? null);
                    }
                }
            }
        }
    }

    /**
     * Execute the query and return the first result.
     *
     * @template T - The type of item to return
     * @returns Promise of first result or null
     */
    async first<T extends ModelInstance = TModel>(): Promise<T | null> {
        const results = await this.limit(1).get<T>();
        return results.first();
    }

    /**
     * Execute the query and return the first result or throw.
     *
     * @template T - The type of item to return
     * @returns Promise of first result
     * @throws Error if no result found
     */
    async firstOrFail<T extends ModelInstance = TModel>(): Promise<T> {
        const result = await this.first<T>();
        if (!result) {
            throw new Error("Query returned no results");
        }
        return result;
    }

    /**
     * Get a single column value from the first result.
     *
     * @param column - Column name
     * @returns Promise of column value or null
     */
    async value(column: string): Promise<WhereClauseValue | null> {
        const result = await this.first();
        if (!result) {
            return null;
        }
        return (result as Record<string, unknown>)[column] as WhereClauseValue | null;
    }

    /**
     * Insert a new record into the database.
     *
     * @param values - Record of values to insert
     * @returns Promise of execution result
     *
     * @example
     * ```typescript
     * await builder.table('users').insert({ name: 'Alice', email: 'alice@example.com' });
     * ```
     */
    async insert(values: MutationValues): Promise<StatementExecutionResult> {
        const sql = this.grammar.compileInsert(this, values);
        const bindings = Object.values(values);

        return this.connection.run(sql, bindings);
    }

    /**
     * Insert multiple records into the database.
     *
     * @param values - Array of records to insert
     * @returns Promise of execution result
     */
    async insertMany(values: MutationValues[]): Promise<StatementExecutionResult> {
        if (values.length === 0 || !values[0]) {
            throw new Error("Cannot insert empty values array");
        }

        // Gather all unique columns across all rows, sort them for consistent SQL
        const columnsSet = new Set<string>();
        for (const row of values) {
            for (const col of Object.keys(row)) {
                columnsSet.add(col);
            }
        }
        const columns = Array.from(columnsSet).sort();

        // Build bulk INSERT: INSERT INTO table (cols) VALUES (?...), (?...), (?...)
        const placeholders = values.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
        const sql = `INSERT INTO ${this.grammar.wrapTable(this.fromTable)} (${columns.map((c) => this.grammar.wrap(c)).join(", ")}) VALUES ${placeholders}`;
        const bindings = values.flatMap((v) => columns.map((col) => v[col] ?? null));

        return this.connection.run(sql, bindings);
    }

    /**
     * Update records in the database.
     *
     * @param values - Record of values to update
     * @returns Promise of execution result
     *
     * @example
     * ```typescript
     * await builder.table('users').where('id', 1).update({ name: 'Bob' });
     * ```
     */
    async update(values: MutationValues): Promise<StatementExecutionResult> {
        const sql = this.grammar.compileUpdate(this, values);
        const updateBindings = Object.values(values);
        // Bindings = update values + where bindings
        const bindings = [...updateBindings, ...this.bindings];

        return this.connection.run(sql, bindings);
    }

    /**
     * Increment a column's value.
     *
     * @param column - Column to increment
     * @param amount - Amount to increment by
     * @param extra - Extra attributes to update
     * @returns Promise of execution result
     */
    async increment(column: string, amount: number = 1, extra: MutationValues = {}): Promise<StatementExecutionResult> {
        const values = {
            [column]: `${this.grammar.wrap(column)} + ${amount}`,
            ...extra,
        };
        return this.update(values);
    }

    /**
     * Decrement a column's value.
     *
     * @param column - Column to decrement
     * @param amount - Amount to decrement by
     * @param extra - Extra attributes to update
     * @returns Promise of execution result
     */
    async decrement(column: string, amount: number = 1, extra: MutationValues = {}): Promise<StatementExecutionResult> {
        const values = {
            [column]: `${this.grammar.wrap(column)} - ${amount}`,
            ...extra,
        };
        return this.update(values);
    }

    /**
     * Delete records from the database.
     *
     * @returns Promise of execution result
     *
     * @example
     * ```typescript
     * await builder.table('users').where('active', false).delete();
     * ```
     */
    async delete(): Promise<StatementExecutionResult> {
        const sql = this.grammar.compileDelete(this);
        return this.connection.run(sql, this.bindings);
    }

    /**
     * Paginate results.
     *
     * @template T - The type of items in pagination result
     * @param perPage - Items per page (default: 15)
     * @param page - Page number (default: 1)
     * @returns Promise of pagination result
     *
     * @example
     * ```typescript
     * const result = await User.query().paginate(20, 2);
     * console.log(`Page ${result.currentPage} of ${result.lastPage}`);
     * ```
     */
    async paginate<T extends ModelInstance = TModel>(
        perPage: number = 15,
        page: number = 1,
    ): Promise<PaginationResult<T>> {
        // Get total count
        const countQuery = new QueryBuilder<T>(this.connection);
        countQuery.from(this.fromTable);
        countQuery.wheres = [...this.wheres];
        countQuery.bindings = [...this.bindings];

        const total = await countQuery.count();

        // Get page data
        const offset = (page - 1) * perPage;
        const items = await this.limit(perPage).offset(offset).get<T>();

        const from = offset + 1;
        const to = Math.min(offset + perPage, total);

        return {
            currentPage: page,
            data: items,
            from,
            lastPage: Math.ceil(total / perPage),
            perPage,
            to,
            total,
        };
    }

    /**
     * Process results in chunks.
     *
     * @template T - The type of items to process
     * @param size - Chunk size
     * @param callback - Function to process each chunk
     * @returns Promise that resolves when all chunks are processed
     *
     * @example
     * ```typescript
     * await User.query().chunk(100, async (users) => {
     *     await processUsers(users);
     * });
     * ```
     */
    async chunk<T extends ModelInstance = TModel>(
        size: number,
        callback: (items: Collection<T>) => void | Promise<void>,
    ): Promise<void> {
        let page = 1;

        while (true) {
            const result = await this.paginate<T>(size, page);

            if (result.data.count() === 0) {
                break;
            }

            await callback(result.data);

            if (page >= result.lastPage) {
                break;
            }

            page++;
        }
    }

    /**
     * Get the count of records matching the query.
     *
     * @param column - Column to count (default: '*')
     * @returns Promise of count
     *
     * @example
     * ```typescript
     * const activeUsers = await User.query().where('active', true).count();
     * ```
     */
    async count(column: string = "*"): Promise<number> {
        const original = this.columns;
        this.columns = [`COUNT(${column}) as count`];

        const sql = this.toSql();
        const result = await this.connection.query<{ count: number }>(sql, this.bindings);

        this.columns = original;

        const firstRow = result[0];
        return firstRow?.count ?? 0;
    }

    /**
     * Get the minimum value of a column.
     *
     * @param column - Column name
     * @returns Promise of minimum value
     */
    async min(column: string): Promise<number | null> {
        const original = this.columns;
        this.columns = [`MIN(${column}) as min`];

        const sql = this.toSql();
        const result = await this.connection.query<{ min: number }>(sql, this.bindings);

        this.columns = original;

        const firstRow = result[0];
        return firstRow?.min ?? null;
    }

    /**
     * Get the maximum value of a column.
     *
     * @param column - Column name
     * @returns Promise of maximum value
     */
    async max(column: string): Promise<number | null> {
        const original = this.columns;
        this.columns = [`MAX(${column}) as max`];

        const sql = this.toSql();
        const result = await this.connection.query<{ max: number }>(sql, this.bindings);

        this.columns = original;

        const firstRow = result[0];
        return firstRow?.max ?? null;
    }

    /**
     * Get the sum of a column.
     *
     * @param column - Column name
     * @returns Promise of sum
     */
    async sum(column: string): Promise<number | null> {
        const original = this.columns;
        this.columns = [`SUM(${column}) as sum`];

        const sql = this.toSql();
        const result = await this.connection.query<{ sum: number }>(sql, this.bindings);

        this.columns = original;

        const firstRow = result[0];
        return firstRow?.sum ?? null;
    }

    /**
     * Get the average value of a column.
     *
     * @param column - Column name
     * @returns Promise of average
     */
    async avg(column: string): Promise<number | null> {
        const original = this.columns;
        this.columns = [`AVG(${column}) as avg`];

        const sql = this.toSql();
        const result = await this.connection.query<{ avg: number }>(sql, this.bindings);

        this.columns = original;

        const firstRow = result[0];
        return firstRow?.avg ?? null;
    }

    /**
     * Execute the query and return all results as an array.
     *
     * @template T - The type of items to return
     * @returns Promise of array
     */
    async pluck<T extends ModelInstance = TModel>(column: string): Promise<Collection<unknown>> {
        const results = await this.get<T>();
        return results.pluck(column as keyof T) as Collection<unknown>;
    }

    /**
     * Determine if any records exist matching the query.
     *
     * @returns Promise of boolean
     */
    async exists(): Promise<boolean> {
        return (await this.count()) > 0;
    }

    /**
     * Determine if no records exist matching the query.
     *
     * @returns Promise of boolean
     */
    async doesntExist(): Promise<boolean> {
        return !(await this.exists());
    }
}
