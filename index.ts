// Connection & Query Builder

// Casts
export { ArrayCast, JsonCast } from "./src/casts/array-cast";
export { BooleanCast } from "./src/casts/boolean-cast";
export {
    type AttributeCaster,
    CastRegistry,
    globalCastRegistry,
} from "./src/casts/cast-registry";
export {
    type CastAttributes,
    type CastsAttributes,
    withCasts,
} from "./src/casts/casts-attributes";
export { DateCast, DateTimeCast, TimestampCast } from "./src/casts/date-cast";
export {
    EnumCast,
    type EnumCastOptions,
    type EnumObject,
} from "./src/casts/enum-cast";
// Core
export { Collection } from "./src/collection";
// Concerns - HasEvents
export type {
    Constructor as EventsConstructor,
    EventCallback,
    EventName,
} from "./src/concerns/has-events";
export { HasEvents } from "./src/concerns/has-events";
// Concerns - HasScopes
export type {
    Constructor as ScopesConstructor,
    ModelWithScopes,
} from "./src/concerns/has-scopes";
export { HasScopes } from "./src/concerns/has-scopes";
// Concerns - HasTimestamps
export type { Constructor as TimestampsConstructor } from "./src/concerns/has-timestamps";
export { HasTimestamps } from "./src/concerns/has-timestamps";
// Concerns - SoftDeletes
export type { Constructor as SoftDeletesConstructor } from "./src/concerns/soft-deletes";
export { SoftDeletes } from "./src/concerns/soft-deletes";
export type {
    DatabaseConnection,
    StatementResult,
    TransactionCallback,
} from "./src/connection";
export { Connection } from "./src/connection";
export { DatabaseManager } from "./src/database-manager";
// Decorators
export { Column } from "./src/decorators/column";
export { Table } from "./src/decorators/table";
// Exceptions
export * from "./src/exceptions";
// Grammar
export { Grammar } from "./src/grammar";
// Model
export type { RelationValue } from "./src/model";
// Model
export { Model, Model as Eloquent, ModelNotFoundException } from "./src/model";
export type { Connector } from "./src/query-builder";
// Query Builder
export { QueryBuilder, QueryBuilder as DB } from "./src/query-builder";
// Relations - Standard
export { BelongsTo } from "./src/relations/belongs-to";
export { BelongsToMany } from "./src/relations/belongs-to-many";
export { HasMany } from "./src/relations/has-many";
export { HasOne } from "./src/relations/has-one";
// Relations - Polymorphic
export { MorphMany } from "./src/relations/morph-many";
export { MorphOne } from "./src/relations/morph-one";
export { MorphTo, type MorphTypeMap } from "./src/relations/morph-to";
export { MorphToMany } from "./src/relations/morph-to-many";
export { Relation } from "./src/relations/relation";
// Transaction
export type {
    TransactionOptions,
    TransactionResult,
    TransactionState,
} from "./src/transaction";

// Transactions
export { Transaction } from "./src/transaction";

// Factory
export {
    Factory,
    configureModelFactory,
    type FactoryResult,
    type FactoryStateCallback,
} from "./src/factory/factory";
// Migration
export type { Migration } from "./src/migration";
export {
    Migrator,
    type MigratorOptions,
    type RefreshOptions,
    type RefreshResult,
    type RollbackOptions,
} from "./src/migrator";

// Seeder
export { Seeder } from "./src/seeder/seeder";
export { SeederRunner } from "./src/seeder/seeder-runner";
// Faker helpers
export { fake, unique } from "./src/support/faker";
// Types
export type * from "./src/types";
