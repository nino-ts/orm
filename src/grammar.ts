import type { JoinClause, MutationValues, OrderClause, QueryState, WhereClause } from "./types";

/**
 * Component compiler method type.
 */
type ComponentCompiler = (query: QueryState) => string | null;

/**
 * Component name for SQL compilation.
 */
type SelectComponent =
    | "aggregate"
    | "columns"
    | "from"
    | "joins"
    | "wheres"
    | "groups"
    | "havings"
    | "orders"
    | "limit"
    | "offset"
    | "lock";

/**
 * The Grammar class is responsible for compiling QueryBuilder components into SQL strings.
 * It handles the differences between SQL dialects (currently focused on standard SQL).
 *
 * @example
 * ```typescript
 * const grammar = new Grammar();
 * const sql = grammar.compileSelect(queryState);
 * ```
 */
export class Grammar {
    protected selectComponents: readonly SelectComponent[] = [
        "aggregate",
        "columns",
        "from",
        "joins",
        "wheres",
        "groups",
        "havings",
        "orders",
        "limit",
        "offset",
        "lock",
    ] as const;

    /**
     * Compile a SELECT query into SQL.
     *
     * @param query - QueryBuilder state
     * @returns Compiled SQL string
     *
     * @example
     * ```typescript
     * const sql = grammar.compileSelect({
     *     columns: ['id', 'name'],
     *     fromTable: 'users',
     *     wheres: [],
     *     orders: []
     * });
     * ```
     */
    compileSelect(query: QueryState): string {
        // If no columns, assume *
        const mutableQuery = { ...query };

        if (!mutableQuery.columns || mutableQuery.columns.length === 0) {
            mutableQuery.columns = ["*"];
        }

        const sql = this.compileComponents(mutableQuery);

        return sql;
    }

    /**
     * Compile an INSERT query into SQL.
     *
     * @param query - QueryBuilder state
     * @param values - Values to insert
     * @returns Compiled SQL string
     *
     * @example
     * ```typescript
     * const sql = grammar.compileInsert(query, { name: 'John', email: 'john@example.com' });
     * ```
     */
    compileInsert(query: QueryState, values: MutationValues): string {
        const table = this.wrapTable(query.fromTable);
        const columns = Object.keys(values).map((column) => this.wrap(column));
        const parameters = Object.keys(values).map(() => "?");

        return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${parameters.join(", ")})`;
    }

    /**
     * Compile an UPDATE query into SQL.
     *
     * @param query - QueryBuilder state
     * @param values - Values to update
     * @returns Compiled SQL string
     *
     * @example
     * ```typescript
     * const sql = grammar.compileUpdate(query, { name: 'Jane' });
     * ```
     */
    compileUpdate(query: QueryState, values: MutationValues): string {
        const table = this.wrapTable(query.fromTable);
        const columns = Object.keys(values)
            .map((key) => `${this.wrap(key)} = ?`)
            .join(", ");
        const where = this.compileWheres(query);

        return `UPDATE ${table} SET ${columns} ${where}`.trim();
    }

    /**
     * Compile a DELETE query into SQL.
     *
     * @param query - QueryBuilder state
     * @returns Compiled SQL string
     *
     * @example
     * ```typescript
     * const sql = grammar.compileDelete(query);
     * ```
     */
    compileDelete(query: QueryState): string {
        const table = this.wrapTable(query.fromTable);
        const where = this.compileWheres(query);

        return `DELETE FROM ${table} ${where}`.trim();
    }

    /**
     * Compile all SELECT components into SQL.
     *
     * @param query - QueryBuilder state
     * @returns Compiled SQL string
     */
    protected compileComponents(query: QueryState): string {
        const sql: string[] = [];

        for (const component of this.selectComponents) {
            const methodName = `compile${component.charAt(0).toUpperCase() + component.slice(1)}` as const;
            const method = this[methodName as keyof this];

            if (typeof method === "function") {
                const part = (method as ComponentCompiler).call(this, query);
                if (part) {
                    sql.push(part);
                }
            }
        }

        return sql.join(" ");
    }

    /**
     * Compile the columns portion of the query.
     *
     * @param query - QueryBuilder state
     * @returns Compiled columns clause
     */
    protected compileColumns(query: QueryState): string {
        if (!query.columns || query.columns.length === 0) {
            return "SELECT *";
        }
        return `SELECT ${query.columns.map((column: string) => this.wrap(column)).join(", ")}`;
    }

    /**
     * Compile the FROM portion of the query.
     *
     * @param query - QueryBuilder state
     * @returns Compiled FROM clause or null
     */
    protected compileFrom(query: QueryState): string | null {
        if (!query.fromTable) {
            return null;
        }
        return `FROM ${this.wrapTable(query.fromTable)}`;
    }

    /**
     * Compile the WHERE portion of the query.
     *
     * @param query - QueryBuilder state
     * @returns Compiled WHERE clause or null
     */
    protected compileWheres(query: QueryState): string | null {
        const wheres = query.wheres;
        if (!wheres || wheres.length === 0) {
            return null;
        }

        const sql = wheres
            .map((where: WhereClause) => {
                const boolean = where.boolean ? where.boolean.toUpperCase() : "AND";
                return `${boolean} ${this.whereToString(where)}`;
            })
            .join(" ");

        return `WHERE ${sql.replace(/^(AND|OR) /, "")}`;
    }

    /**
     * Convert a WhereClause to SQL string.
     *
     * @param where - WhereClause to convert
     * @returns SQL string representation
     */
    protected whereToString(where: WhereClause): string {
        switch (where.type) {
            case "Basic":
                return `${this.wrap(where.column)} ${where.operator} ?`;

            case "Null":
                return where.not ? `${this.wrap(where.column)} IS NOT NULL` : `${this.wrap(where.column)} IS NULL`;

            case "In": {
                if (where.values.length === 0) {
                    return where.not ? "1 = 1" : "0 = 1";
                }
                const placeholders = where.values.map(() => "?").join(", ");
                const operator = where.not ? "NOT IN" : "IN";
                return `${this.wrap(where.column)} ${operator} (${placeholders})`;
            }

            case "Between": {
                const operator = where.not ? "NOT BETWEEN" : "BETWEEN";
                return `${this.wrap(where.column)} ${operator} ? AND ?`;
            }

            case "Column":
                return `${this.wrap(where.first)} ${where.operator} ${this.wrap(where.second)}`;

            default: {
                // Exhaustiveness check
                const _exhaustive: never = where;
                void _exhaustive;
                return "";
            }
        }
    }

    /**
     * Compile the ORDER BY portion of the query.
     *
     * @param query - QueryBuilder state
     * @returns Compiled ORDER BY clause or null
     */
    protected compileOrders(query: QueryState): string | null {
        const orders = query.orders;
        if (!orders || orders.length === 0) {
            return null;
        }
        return (
            "ORDER BY " +
            orders.map((order: OrderClause) => `${this.wrap(order.column)} ${order.direction.toUpperCase()}`).join(", ")
        );
    }

    /**
     * Compile the LIMIT portion of the query.
     *
     * @param query - QueryBuilder state
     * @returns Compiled LIMIT clause or null
     */
    protected compileLimit(query: QueryState): string | null {
        if (query.limitValue === undefined || query.limitValue === null) {
            return null;
        }
        return `LIMIT ${query.limitValue}`;
    }

    /**
     * Compile the OFFSET portion of the query.
     *
     * @param query - QueryBuilder state
     * @returns Compiled OFFSET clause or null
     */
    protected compileOffset(query: QueryState): string | null {
        if (query.offsetValue === undefined || query.offsetValue === null) {
            return null;
        }
        return `OFFSET ${query.offsetValue}`;
    }

    /**
     * Compile the JOIN portion of the query.
     *
     * @param query - QueryBuilder state
     * @returns Compiled JOIN clauses or null
     */
    protected compileJoins(query: QueryState): string | null {
        const joins = query.joins;
        if (!joins || joins.length === 0) {
            return null;
        }

        return joins
            .map((join: JoinClause) => {
                const type = join.type === "inner" ? "INNER" : join.type.toUpperCase();
                return `${type} JOIN ${this.wrapTable(join.table)} ON ${this.wrap(join.first)} ${join.operator} ${this.wrap(join.second)}`;
            })
            .join(" ");
    }

    /**
     * Wrap a value in keyword identifiers.
     * @param value Value to wrap
     */
    wrap(value: string): string {
        if (value === "*") {
            return value;
        }
        return value;
    }

    /**
     * Wrap a table in identifiers.
     * @param table Table to wrap
     */
    wrapTable(table: string): string {
        return this.wrap(table);
    }
}
