/**
 * ORM Type Definitions with Strict Typing
 *
 * Zero explicit `any` usage - All types explicitly defined with proper constraints.
 *
 * @packageDocumentation
 */

import type { Collection } from "./collection";

// ============================================================================
// Database Driver Types
// ============================================================================

/**
 * Supported database drivers.
 */
export type DatabaseDriver = "sqlite" | "postgres" | "postgresql" | "mysql";

/**
 * Database connection configuration.
 *
 * @example
 * ```typescript
 * const config: ConnectionConfig = {
 *     driver: 'postgres',
 *     host: 'localhost',
 *     port: 5432,
 *     database: 'myapp',
 *     username: 'user',
 *     password: 'pass',
 * };
 * ```
 */
export interface ConnectionConfig {
    readonly driver: DatabaseDriver;
    readonly url?: string;
    readonly host?: string;
    readonly port?: number;
    // `database` may be omitted for some drivers (e.g. when using URL or sqlite filename)
    readonly database?: string;
    readonly username?: string;
    readonly password?: string;
    readonly socket?: string;
    readonly filename?: string; // SQLite only
    readonly foreignKeys?: boolean; // SQLite only
    // Bun SQL native options
    readonly max?: number; // Connection pool size
    readonly idleTimeout?: number; // Milliseconds
    readonly connectionTimeout?: number; // Milliseconds
    readonly bigint?: "string" | "number" | "bigint"; // BigInt handling
}

// ============================================================================
// Query Builder Types
// ============================================================================

/**
 * SQL comparison operators.
 */
export type Operator =
    | "="
    | "!="
    | "<>"
    | "<"
    | ">"
    | "<="
    | ">="
    | "like"
    | "not like"
    | "in"
    | "not in"
    | "between"
    | "not between"
    | "is null"
    | "is not null";

/**
 * Primitive values allowed in WHERE clauses.
 */
export type WhereClauseValue = string | number | boolean | Date | null;

/**
 * Boolean conjunction operators for WHERE clauses.
 */
export type BooleanOperator = "and" | "or";

/**
 * Discriminated union for different WHERE clause types.
 *
 * Type-safe representation using discriminated unions to enable
 * exhaustiveness checking and proper type narrowing.
 *
 * @example
 * ```typescript
 * const basicWhere: WhereClause = {
 *     type: 'Basic',
 *     column: 'age',
 *     operator: '>',
 *     value: 18,
 *     boolean: 'and',
 * };
 *
 * const nullWhere: WhereClause = {
 *     type: 'Null',
 *     column: 'deleted_at',
 *     boolean: 'and',
 * };
 * ```
 */
export type WhereClause =
    | {
          readonly type: "Basic";
          readonly column: string;
          readonly operator: Operator;
          readonly value: WhereClauseValue;
          readonly boolean: BooleanOperator;
      }
    | {
          readonly type: "Null";
          readonly column: string;
          readonly not?: boolean;
          readonly boolean: BooleanOperator;
      }
    | {
          readonly type: "In";
          readonly column: string;
          readonly values: readonly WhereClauseValue[];
          readonly not?: boolean;
          readonly boolean: BooleanOperator;
      }
    | {
          readonly type: "Between";
          readonly column: string;
          readonly min: WhereClauseValue;
          readonly max: WhereClauseValue;
          readonly not?: boolean;
          readonly boolean: BooleanOperator;
      }
    | {
          readonly type: "Column";
          readonly first: string;
          readonly operator: Operator;
          readonly second: string;
          readonly boolean: BooleanOperator;
      };

/**
 * ORDER BY clause definition.
 */
export interface OrderClause {
    readonly column: string;
    readonly direction: "asc" | "desc";
}

/**
 * JOIN types supported by the query builder.
 */
export type JoinType = "inner" | "left" | "right" | "cross";

/**
 * JOIN clause definition.
 *
 * @example
 * ```typescript
 * const join: JoinClause = {
 *     type: 'inner',
 *     table: 'posts',
 *     first: 'users.id',
 *     operator: '=',
 *     second: 'posts.user_id',
 * };
 * ```
 */
export interface JoinClause {
    readonly type: JoinType;
    readonly table: string;
    readonly first: string;
    readonly operator: string;
    readonly second: string;
}

/**
 * Query options for pagination and ordering.
 */
export interface QueryOptions {
    readonly limit?: number;
    readonly offset?: number;
    readonly orderBy?: readonly OrderClause[];
    readonly groupBy?: readonly string[];
}

// ============================================================================
// Model Types
// ============================================================================

/**
 * Generic type for model attributes.
 *
 * Maps keys to their corresponding value types for type-safe attribute access.
 *
 * @template T - The object type representing all model attributes
 */
export type ModelAttributes<T extends object> = {
    [K in keyof T]: T[K];
};

/**
 * Type for INSERT operations — excludes auto-generated fields.
 *
 * This is the TypeScript-native replacement for Laravel's `$fillable`.
 * Instead of runtime mass assignment protection, the type system itself
 * prevents setting fields like `id`, `created_at`, `updated_at`.
 *
 * Inspired by Prisma's `UserCreateInput` and Drizzle's `$inferInsert`.
 *
 * @template T - The model attributes type
 *
 * @example
 * ```typescript
 * type NewUser = ModelCreateInput<UserAttributes>;
 * // { name: string; email: string; password: string; is_admin: boolean }
 * // → 'id', 'created_at', 'updated_at' are excluded
 * ```
 */
export type ModelCreateInput<T extends object> = Omit<T, "id" | "created_at" | "updated_at">;

/**
 * Type for UPDATE operations — all fields optional, excludes primary key.
 *
 * @template T - The model attributes type
 *
 * @example
 * ```typescript
 * type UpdateUser = ModelUpdateInput<UserAttributes>;
 * // { name?: string; email?: string; password?: string; is_admin?: boolean }
 * ```
 */
export type ModelUpdateInput<T extends object> = Partial<Omit<T, "id">>;

/**
 * Type for SELECT results — full readonly model shape.
 *
 * Equivalent to Drizzle's `$inferSelect`.
 *
 * @template T - The model attributes type
 */
export type ModelSelectOutput<T extends object> = Readonly<T>;

/**
 * Constructor type for model classes.
 *
 * Enables type-safe model instantiation and reflection.
 *
 * @template T - The Model class type
 */
export interface ModelConstructor<T extends object> {
    new (attributes?: Partial<Record<string, unknown>>): T;
    getTable(): string;
}

/**
 * Primary key type - typically number or string.
 */
export type PrimaryKey = number | string;

/**
 * Fillable attributes map for mass assignment protection.
 */
export type FillableAttributes<T extends object> = Partial<ModelAttributes<T>>;

// ============================================================================
// Collection & Pagination Types
// ============================================================================

/**
 * Cast types for attribute transformation.
 */
export type CastType =
    | "string"
    | "integer"
    | "float"
    | "boolean"
    | "date"
    | "datetime"
    | "timestamp"
    | "json"
    | "array"
    | "enum";

/**
 * Pagination result structure.
 *
 * @template T - The type of items in the paginated result
 *
 * @example
 * ```typescript
 * const users: PaginationResult<User> = await User.query().paginate(15, 1);
 * console.log(`Page ${users.currentPage} of ${users.lastPage}`);
 * ```
 */
export interface PaginationResult<T> {
    readonly data: Collection<T>;
    readonly total: number;
    readonly perPage: number;
    readonly currentPage: number;
    readonly lastPage: number;
    readonly from: number;
    readonly to: number;
}

// ============================================================================
// Relation Types (placeholders for future implementation)
// ============================================================================

/**
 * Relation types for model associations.
 */
export type RelationType = "hasOne" | "hasMany" | "belongsTo" | "belongsToMany";

/**
 * Foreign key configuration for relations.
 */
export interface ForeignKeyConfig {
    readonly localKey: string;
    readonly foreignKey: string;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction isolation levels.
 */
export type IsolationLevel = "READ UNCOMMITTED" | "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";

// ============================================================================
// Schema/Migration Types (placeholders)
// ============================================================================

/**
 * Column data types for migrations.
 */
export type ColumnType =
    | "string"
    | "text"
    | "integer"
    | "bigInteger"
    | "float"
    | "double"
    | "decimal"
    | "boolean"
    | "date"
    | "dateTime"
    | "time"
    | "timestamp"
    | "json"
    | "binary"
    | "uuid";

/**
 * Column definition for schema builder.
 */
export interface ColumnDefinition {
    readonly name: string;
    readonly type: ColumnType;
    readonly nullable?: boolean;
    readonly default?: WhereClauseValue;
    readonly primary?: boolean;
    readonly unique?: boolean;
    readonly index?: boolean;
    readonly unsigned?: boolean;
    readonly length?: number;
}

// ============================================================================
// Query Builder Types
// ============================================================================

/**
 * Model instance with basic properties.
 *
 * Models can have additional properties beyond these base ones.
 */
export interface ModelInstance extends Record<string, unknown> {
    /**
     * Primary key (usually id).
     */
    readonly id?: PrimaryKey;

    /**
     * Whether the model exists in database.
     */
    exists?: boolean;

    /**
     * Fill model with attributes.
     */
    fill(attributes: Record<string, unknown>): void;

    /**
     * Set a relation on the model.
     */
    setRelation?(name: string, value: unknown): void;
}

/**
 * Generic record type for database rows.
 */
export type DatabaseRow = Record<string, WhereClauseValue | unknown>;

/**
 * Insert/Update values type.
 */
export type MutationValues = Record<string, WhereClauseValue>;

/**
 * Statement execution result (from connection).
 */
export interface StatementExecutionResult {
    readonly lastInsertId?: PrimaryKey | null;
    readonly changes?: number;
    readonly affectedRows?: number;
    readonly insertId?: PrimaryKey;
}

/**
 * Query builder state.
 */
export interface QueryState {
    readonly columns: readonly string[];
    readonly fromTable: string;
    readonly wheres: readonly WhereClause[];
    readonly orders: readonly OrderClause[];
    readonly joins: readonly JoinClause[];
    readonly limitValue?: number;
    readonly offsetValue?: number;
}
