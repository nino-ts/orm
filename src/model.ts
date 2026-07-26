import type { Collection } from "./collection";
import type { Connection } from "./connection";
import type { DatabaseManager } from "./database-manager";
import { QueryBuilder } from "./query-builder";
import { BelongsTo } from "./relations/belongs-to";
import { BelongsToMany } from "./relations/belongs-to-many";
import { HasMany } from "./relations/has-many";
import { HasOne } from "./relations/has-one";
import type { ModelConstructor, ModelInstance, MutationValues, PrimaryKey, WhereClauseValue } from "./types";

/**
 * Exception thrown when a model is not found.
 *
 * @example
 * ```typescript
 * const user = await User.findOrFail(999);
 * // throws ModelNotFoundException: No query results for model [User] 999
 * ```
 */
export class ModelNotFoundException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ModelNotFoundException";
    }
}

/**
 * Type for column mapping metadata.
 * Maps property names to database column names.
 */
export type ColumnMapping = Record<string, string>;

/**
 * Type for model constructor with metadata.
 */
export interface ModelConstructorWithMetadata<T extends object = object> extends ModelConstructor<T> {
    /**
     * Column mapping for decorated properties.
     */
    __columnMapping?: ColumnMapping;

    /**
     * Primary key column name.
     */
    primaryKey: string;

    /**
     * Primary key type.
     */
    keyType: "int" | "string";

    /**
     * Whether the primary key is auto-incrementing.
     */
    incrementing: boolean;

    /**
     * Get the table name associated with the model.
     */
    getTable(): string;
}

/**
 * Type for relation values.
 */
export type RelationValue = Model | Collection<Model> | null | undefined;

/**
 * The Model class represents a database table/record and provides an Active Record implementation.
 * It serves as the base class for all application models.
 *
 * @template TAttributes - The shape of model attributes
 *
 * @example
 * ```typescript
 * interface UserAttributes {
 *     id: number;
 *     name: string;
 *     email: string;
 * }
 *
 * class User extends Model<UserAttributes> {
 *     protected static table = 'users';
 * }
 *
 * const user = new User({ name: 'John', email: 'john@example.com' });
 * await user.save();
 * ```
 */
export class Model<TAttributes extends object = Record<string, unknown>> implements ModelInstance {
    /**
     * Index signature to satisfy ModelInstance interface.
     * Allows dynamic property access via Proxy.
     */
    [key: string]: unknown;

    protected static resolver: DatabaseManager;
    protected static table: string;
    protected static primaryKey: string = "id";
    protected static keyType: "int" | "string" = "int";
    protected static incrementing: boolean = true;
    /**
     * Mass-assignable attribute names (Laravel `$fillable` equivalent).
     */
    protected static fillable: string[] = [];
    /**
     * Attributes to hide from serialization (toArray/toJSON).
     * Type-safe: only keys of TAttributes are accepted.
     */
    protected static hidden: string[] = [];

    /**
     * Attributes to show in serialization (if set, only these are included).
     * Takes precedence over `hidden`.
     */
    protected static visible: string[] = [];

    /**
     * Attribute cast definitions.
     * Maps attribute names to cast types ('boolean', 'integer', 'float', 'string', 'json', 'array', 'datetime', 'date').
     */
    protected static casts: Record<string, string> = {};

    protected attributes: Partial<TAttributes> = {};
    protected original: Partial<TAttributes> = {};
    public exists: boolean = false;
    protected relations: Map<string, RelationValue> = new Map();
    protected _modelClass: ModelConstructorWithMetadata<TAttributes>;

    /**
     * Create a new Model instance.
     *
     * @param attributes - Initial attributes
     *
     * @example
     * ```typescript
     * const user = new User({ name: 'John', email: 'john@example.com' });
     * ```
     */
    constructor(attributes: Partial<TAttributes> = {}) {
        // Store class reference BEFORE creating proxy
        this._modelClass = this.constructor as ModelConstructorWithMetadata<TAttributes>;
        this.fill(attributes);

        // Proxy for direct attribute access
        return new Proxy(this, {
            get(target, prop, receiver): unknown {
                // Allow access to instance methods and properties via Reflect first
                if (Reflect.has(target, prop)) {
                    const value = Reflect.get(target, prop, receiver);
                    // If it's a relation method AND the relation is loaded, return loaded data
                    if (typeof value === "function" && typeof prop === "string") {
                        const loadedRelation = target.relations.get(prop);
                        if (loadedRelation !== undefined) {
                            return loadedRelation;
                        }
                    }
                    return value;
                }

                // Check for accessor: get{Attribute}Attribute
                if (typeof prop === "string") {
                    const accessorName = `get${target.studly(prop)}Attribute`;
                    const accessor = (target as Record<string, unknown>)[accessorName];
                    if (typeof accessor === "function") {
                        return (accessor as () => unknown).call(target);
                    }
                }

                // Column Mapping Support
                const modelConstructor = target.constructor as ModelConstructorWithMetadata;
                const mapping = modelConstructor.__columnMapping;
                if (mapping && typeof prop === "string" && mapping[prop]) {
                    const mappedKey = mapping[prop] as keyof TAttributes;
                    return target.attributes[mappedKey];
                }

                if (typeof prop === "string" && Object.hasOwn(target.attributes, prop)) {
                    return target.attributes[prop as keyof TAttributes];
                }

                return undefined;
            },
            set(target, prop, value, receiver): boolean {
                if (Reflect.has(target, prop)) {
                    return Reflect.set(target, prop, value, receiver);
                }

                // Check for mutator: set{Attribute}Attribute
                if (typeof prop === "string") {
                    const mutatorName = `set${target.studly(prop)}Attribute`;
                    const mutator = (target as Record<string, unknown>)[mutatorName];
                    if (typeof mutator === "function") {
                        (mutator as (val: unknown) => void).call(target, value);
                        return true;
                    }
                }

                // Column Mapping Support
                const modelConstructor = target.constructor as ModelConstructorWithMetadata;
                const mapping = modelConstructor.__columnMapping;
                if (mapping && typeof prop === "string" && mapping[prop]) {
                    target.setAttribute(mapping[prop] as string, value);
                    return true;
                }

                if (typeof prop === "string") {
                    target.setAttribute(prop, value);
                    return true;
                }
                return false;
            },
        });
    }

    /**
     * Convert snake_case to StudlyCase for accessor/mutator method names
     */
    protected studly(value: string): string {
        return value
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join("");
    }

    /**
     * Fill the model with an array of attributes.
     *
     * @param attributes - Key-value pairs of attributes
     * @returns This model instance for chaining
     *
     * @example
     * ```typescript
     * user.fill({ name: 'Jane', email: 'jane@example.com' });
     * ```
     */
    fill(attributes: Partial<TAttributes>): this {
        for (const key in attributes) {
            if (Object.hasOwn(attributes, key)) {
                this.setAttribute(key, attributes[key]);
            }
        }
        return this;
    }

    /**
     * Set a given attribute on the model.
     *
     * @param key - Attribute name
     * @param value - Attribute value
     *
     * @example
     * ```typescript
     * user.setAttribute('name', 'John');
     * ```
     */
    setAttribute(key: string, value: unknown): void {
        this.attributes[key as keyof TAttributes] = value as TAttributes[keyof TAttributes];
    }

    /**
     * Get an attribute from the model.
     *
     * @param key - Attribute name
     * @returns The attribute value or undefined
     *
     * @example
     * ```typescript
     * const name = user.getAttribute('name');
     * ```
     */
    getAttribute(key: string): unknown {
        return this.attributes[key as keyof TAttributes];
    }

    /**
     * Set the connection resolver instance.
     * @param resolver DatabaseManager instance
     */
    static setConnectionResolver(resolver: DatabaseManager) {
        Model.resolver = resolver;
    }

    /**
     * Get the connection resolver instance.
     */
    static getConnectionResolver(): DatabaseManager {
        return Model.resolver;
    }

    /**
     * Get the database connection for the model.
     */
    getConnection(): Connection {
        return Model.resolver.connection();
    }

    /**
     * Resolve a connection instance.
     * @param name Connection name
     */
    static resolveConnection(name?: string): Connection {
        return Model.resolver.connection(name);
    }

    /**
     * Get the table associated with the model.
     *
     * @returns The table name
     */
    static getTable(this: ModelConstructor<Model>): string {
        if ((this as unknown as { table?: string }).table) {
            return (this as unknown as { table: string }).table;
        }
        // Simple pluralizer fallback if no helper
        // snake_case class name + s
        const name = (this as unknown as { name: string }).name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
        return `${name}s`;
    }

    /**
     * Get the table associated with the model instance.
     */
    getTable(): string {
        return this._modelClass.getTable();
    }

    /**
     * Begin querying the model.
     *
     * @returns Query builder instance for this model
     */
    static query<T extends Model>(this: new () => T): QueryBuilder<T> {
        const instance = new (this as unknown as new () => T)();
        return instance.newQuery() as QueryBuilder<T>;
    }

    /**
     * newQuery method com tipagem correta.
     *
     * @returns Query builder instance for this model
     */
    newQuery(): QueryBuilder<Model<TAttributes>> {
        const builder = new QueryBuilder<Model<TAttributes>>(this.getConnection());
        builder.from(this.getTable());
        builder.setModel(this._modelClass as unknown as ModelConstructor<Model<TAttributes>>);
        return builder;
    }

    /**
     * Begin querying the model with eager loading.
     *
     * @param relations - Relations to eager load
     * @returns Query builder instance
     */
    static with<T extends Model>(this: new () => T, ...relations: string[]): QueryBuilder<T> {
        const builder = (this as unknown as { query(): QueryBuilder<T> }).query();
        builder.with(...relations);
        return builder as QueryBuilder<T>;
    }

    /**
     * Resolve the model factory registered via `configureModelFactory`.
     *
     * @param count - Optional number of models to generate
     * @returns Factory instance for this model
     */
    static factory<T extends Model>(this: new () => T): import("./factory/factory").Factory<T>;
    static factory<T extends Model, N extends number>(
        this: new () => T,
        count: N,
    ): import("./factory/factory").Factory<T, Record<string, unknown>, N>;
    static factory<T extends Model>(
        this: new () => T,
        count?: number,
    ): import("./factory/factory").Factory<T> {
        void count;
        throw new Error(
            `No factory configured for [${this.name}]. Call configureModelFactory() first.`,
        );
    }

    /**
     * Get all of the models from the database.
     *
     * @returns Collection of models
     */
    static async all<T extends Model>(this: new () => T): Promise<Collection<T>> {
        const query = (this as unknown as { query(): QueryBuilder<T> }).query();
        return query.get() as Promise<Collection<T>>;
    }

    /**
     * Find a model by its primary key.
     *
     * @param id - Primary key value
     * @returns The model instance or null if not found
     */
    /**
     * Find a model by its primary key.
     *
     * @param id - Primary key value
     * @returns The model instance or null if not found
     */
    static async find<T extends Model>(this: new () => T, id: PrimaryKey): Promise<T | null> {
        const instance = new (this as unknown as new () => T)();
        const primaryKey = (instance.constructor as typeof Model).primaryKey;

        return instance.newQuery().where(primaryKey, id).first() as Promise<T | null>;
    }

    /**
     * Save a new model and return the instance.
     *
     * @param attributes - Attributes to create the model with
     * @returns The created model instance
     */
    static async create<T extends Model>(this: new () => T, attributes: Partial<T["attributes"]>): Promise<T> {
        const instance = new (this as unknown as new () => T)();
        instance.fill(attributes);
        await instance.save();
        return instance;
    }

    /**
     * Get the first record matching the attributes or create it.
     *
     * @param attributes - Attributes to find the record
     * @param values - Additional attributes to set if creating
     * @returns The existing or created model instance
     */
    static async firstOrCreate<T extends Model>(
        this: new () => T,
        attributes: Record<string, WhereClauseValue>,
        values: Partial<T["attributes"]> = {},
    ): Promise<T> {
        const instance = new (this as unknown as new () => T)();
        const existing = (await instance.newQuery().where(attributes).first()) as T | null;

        if (existing) {
            return existing;
        }

        const newInstance = new (this as unknown as new () => T)();
        newInstance.fill({ ...attributes, ...values } as Partial<T["attributes"]>);
        await newInstance.save();
        return newInstance;
    }

    /**
     * Set the specific relationship in the model.
     *
     * @param name - Relation name
     * @param value - Relation value (Model, Collection, or null)
     * @returns This model instance for chaining
     *
     * @example
     * ```typescript
     * user.setRelation('posts', postCollection);
     * ```
     */
    setRelation(name: string, value: RelationValue): this {
        this.relations.set(name, value);
        return this;
    }

    /**
     * Get the specified relationship.
     *
     * @param name - Relation name
     * @returns The loaded relation or undefined if not loaded
     *
     * @example
     * ```typescript
     * const posts = user.getRelation('posts');
     * ```
     */
    getRelation(name: string): RelationValue {
        return this.relations.get(name);
    }

    /**
     * Save the model to the database.
     * @returns True if saved successfully
     */
    async save(): Promise<boolean> {
        const query = this.newQuery();

        if (this.exists) {
            // Update - need to use base query without scopes for update
            const pk = this._modelClass.primaryKey;
            const id = this.getAttribute(pk);
            if (id) {
                await query.where(pk, "=", id as WhereClauseValue).update(this.attributes as unknown as MutationValues);
            }
            this.syncOriginal();
            return true;
        } else {
            // Insert
            const result = await query.insert(this.attributes as unknown as MutationValues);
            this.exists = true;

            // Only update ID if auto-incrementing
            if (this._modelClass.incrementing && result?.lastInsertId) {
                this.setAttribute(this._modelClass.primaryKey, result.lastInsertId);
            }
            this.syncOriginal();
            return true;
        }
    }

    /**
     * Delete the model from the database.
     *
     * @returns True if deleted successfully
     *
     * @example
     * ```typescript
     * const user = await User.findOrFail(1);
     * await user.delete(); // DELETE FROM users WHERE id = 1
     * ```
     */
    async delete(): Promise<boolean> {
        if (!this.exists) {
            return false;
        }
        const pk = this._modelClass.primaryKey;
        const id = this.getAttribute(pk);
        if (!id) {
            return false;
        }
        await this.newQuery()
            .where(pk, "=", id as WhereClauseValue)
            .delete();
        this.exists = false;
        return true;
    }

    // ========================================================================
    // Dirty Tracking
    // ========================================================================

    /**
     * Determine if the model or any of the given attributes have been modified.
     *
     * @param keys - Optional attribute keys to check
     * @returns True if the model (or specified keys) has unsaved changes
     *
     * @example
     * ```typescript
     * user.name = 'New Name';
     * user.isDirty();       // true
     * user.isDirty('name'); // true
     * user.isDirty('email'); // false
     * ```
     */
    isDirty(...keys: (keyof TAttributes)[]): boolean {
        const dirty = this.getDirty();
        if (keys.length === 0) {
            return Object.keys(dirty).length > 0;
        }
        return keys.some((key) => key in dirty);
    }

    /**
     * Determine if the model or any of the given attributes have NOT been modified.
     *
     * @param keys - Optional attribute keys to check
     * @returns True if the model (or specified keys) has no unsaved changes
     */
    isClean(...keys: (keyof TAttributes)[]): boolean {
        return !this.isDirty(...keys);
    }

    /**
     * Get the attributes that have been changed since the last sync.
     *
     * @returns Object containing only the modified attributes
     */
    getDirty(): Partial<TAttributes> {
        const dirty: Partial<TAttributes> = {};
        for (const key of Object.keys(this.attributes) as (keyof TAttributes)[]) {
            if (this.attributes[key] !== this.original[key]) {
                dirty[key] = this.attributes[key];
            }
        }
        return dirty;
    }

    /**
     * Sync the original attributes with the current.
     * Called after successful save/hydration.
     *
     * @returns This model instance for chaining
     */
    syncOriginal(): this {
        this.original = { ...this.attributes };
        return this;
    }

    // ========================================================================
    // Serialization
    // ========================================================================

    /**
     * Convert the model to a plain object, respecting `hidden` and `visible`.
     *
     * If `visible` is set, only those keys are included.
     * Otherwise, keys in `hidden` are excluded.
     * Loaded relations are included.
     *
     * @returns Plain object representation
     *
     * @example
     * ```typescript
     * class User extends Model<UserAttributes> {
     *   protected static hidden: (keyof UserAttributes)[] = ['password'];
     * }
     * user.toArray(); // { id: 1, name: 'João', email: '...' } — no password
     * ```
     */
    toArray(): Partial<TAttributes> {
        const Ctor = this.constructor as typeof Model;
        const result = { ...this.attributes } as Record<string, unknown>;

        if (Ctor.visible.length > 0) {
            // Visible mode: only include listed keys
            for (const key of Object.keys(result)) {
                if (!Ctor.visible.includes(key)) {
                    delete result[key];
                }
            }
        } else {
            // Hidden mode: exclude listed keys
            for (const key of Ctor.hidden) {
                delete result[key];
            }
        }

        // Include loaded relations
        for (const [name, value] of this.relations) {
            result[name] = value;
        }

        return result as Partial<TAttributes>;
    }

    /**
     * Convert the model to a JSON string.
     * Respects `hidden` and `visible` settings.
     *
     * @returns JSON string representation
     */
    toJSON(): string {
        return JSON.stringify(this.toArray());
    }

    // ========================================================================
    // Static Query Shortcuts
    // ========================================================================

    /**
     * Find a model by its primary key or throw an exception.
     *
     * @param id - Primary key value
     * @returns The model instance
     * @throws ModelNotFoundException if not found
     *
     * @example
     * ```typescript
     * const user = await User.findOrFail(1);
     * // throws ModelNotFoundException if user with id 1 doesn't exist
     * ```
     */
    static async findOrFail<T extends Model>(this: new () => T, id: PrimaryKey): Promise<T> {
        const instance = new (this as unknown as new () => T)();
        const primaryKey = (instance.constructor as typeof Model).primaryKey;
        const result = (await instance.newQuery().where(primaryKey, id).first()) as T | null;
        if (!result) {
            const modelName = (this as unknown as { name: string }).name;
            throw new ModelNotFoundException(`No query results for model [${modelName}] ${id}`);
        }
        return result;
    }

    /**
     * Create or update a record matching the attributes, and fill it with values.
     *
     * @param attributes - Attributes to match (WHERE clause)
     * @param values - Values to update or set on creation
     * @returns The updated or created model instance
     *
     * @example
     * ```typescript
     * const user = await User.updateOrCreate(
     *   { email: 'joao@ninots.dev' },
     *   { name: 'João', password: hashedPassword },
     * );
     * ```
     */
    static async updateOrCreate<T extends Model>(
        this: new () => T,
        attributes: Record<string, WhereClauseValue>,
        values: Record<string, unknown> = {},
    ): Promise<T> {
        const query = (this as unknown as { query(): QueryBuilder<T> }).query();
        const existing = (await query.where(attributes).first()) as T | null;

        if (existing) {
            existing.fill(values as Partial<T["attributes"]>);
            await existing.save();
            return existing;
        }

        const instance = new (this as unknown as new () => T)();
        instance.fill({ ...attributes, ...values } as Partial<T["attributes"]>);
        await instance.save();
        return instance;
    }

    /**
     * Get the first record matching the attributes or instantiate a new model (without persisting).
     *
     * @param attributes - Attributes to search for
     * @param values - Additional attributes for the new instance
     * @returns The existing or new (non-persisted) model instance
     *
     * @example
     * ```typescript
     * const user = await User.firstOrNew(
     *   { email: 'joao@ninots.dev' },
     *   { name: 'João' },
     * );
     * if (!user.exists) {
     *   await user.save(); // only saves if it's a new record
     * }
     * ```
     */
    static async firstOrNew<T extends Model>(
        this: new () => T,
        attributes: Record<string, WhereClauseValue>,
        values: Record<string, unknown> = {},
    ): Promise<T> {
        const query = (this as unknown as { query(): QueryBuilder<T> }).query();
        const existing = (await query.where(attributes).first()) as T | null;
        if (existing) {
            return existing;
        }

        const instance = new (this as unknown as new () => T)();
        instance.fill({ ...attributes, ...values } as Partial<T["attributes"]>);
        return instance; // NOT persisted
    }

    /**
     * Execute a raw SQL query using tagged templates.
     *
     * This is a TypeScript/JavaScript-native feature that PHP doesn't have.
     * Goes directly to the Bun.sql driver without passing through the Grammar.
     *
     * @template T - The expected row type
     * @returns Array of result rows
     *
     * @example
     * ```typescript
     * const stats = await User.raw`
     *   SELECT role, COUNT(*) as total
     *   FROM users
     *   WHERE active = ${true}
     *   GROUP BY role
     * `;
     * ```
     */
    static async raw<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
        const conn = Model.resolver.connection();
        // Build SQL string with positional placeholders
        const sql = strings.reduce((result, str, i) => result + str + (i < values.length ? "?" : ""), "");
        return conn.query<T>(sql, values as WhereClauseValue[]);
    }

    /**
     * Define a one-to-one relationship.
     * @param related Related model class
     * @param foreignKey Foreign key on related model
     * @param localKey Local key on this model
     */
    hasOne<TRelated extends Model<Record<string, unknown>>>(
        related: new () => TRelated,
        foreignKey?: string,
        localKey?: string,
    ): HasOne<TRelated, Model<Record<string, unknown>>> {
        const instance = new related();
        const resolvedForeignKey = foreignKey ?? this.getForeignKey();
        const resolvedLocalKey = localKey ?? this._modelClass.primaryKey;

        return new HasOne(
            instance.newQuery() as unknown as QueryBuilder<TRelated>,
            this as unknown as Model<Record<string, unknown>>,
            resolvedForeignKey,
            resolvedLocalKey,
        );
    }

    /**
     * Define a one-to-many relationship.
     * @param related Related model class
     * @param foreignKey Foreign key on related model
     * @param localKey Local key on this model
     */
    hasMany<TRelated extends Model<Record<string, unknown>>>(
        related: new () => TRelated,
        foreignKey?: string,
        localKey?: string,
    ): HasMany<TRelated, Model<Record<string, unknown>>> {
        const instance = new related();
        const resolvedForeignKey = foreignKey ?? this.getForeignKey();
        const resolvedLocalKey = localKey ?? this._modelClass.primaryKey;

        return new HasMany(
            instance.newQuery() as unknown as QueryBuilder<TRelated>,
            this as unknown as Model<Record<string, unknown>>,
            resolvedForeignKey,
            resolvedLocalKey,
        );
    }

    /**
     * Define an inverse one-to-one or many-to-one relationship.
     * @param related Related model class
     * @param foreignKey Foreign key on this model
     * @param ownerKey Owner key on related model
     */
    belongsTo<TRelated extends Model<Record<string, unknown>>>(
        related: new () => TRelated,
        foreignKey?: string,
        ownerKey?: string,
    ): BelongsTo<TRelated, Model<Record<string, unknown>>> {
        const instance = new related();
        const resolvedForeignKey =
            foreignKey ??
            `${(instance.constructor as typeof Model).name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()}_id`;
        const resolvedOwnerKey = ownerKey ?? (instance.constructor as typeof Model).primaryKey;

        return new BelongsTo(
            instance.newQuery() as unknown as QueryBuilder<TRelated>,
            this as unknown as Model<Record<string, unknown>>,
            resolvedForeignKey,
            resolvedOwnerKey,
        );
    }

    /**
     * Define a many-to-many relationship.
     * @param related Related model class
     * @param table Pivot table name
     * @param foreignPivotKey Foreign key for this model on pivot
     * @param relatedPivotKey Foreign key for related model on pivot
     * @param parentKey Key on this model
     * @param relatedKey Key on related model
     */
    belongsToMany<TRelated extends Model<Record<string, unknown>>>(
        related: new () => TRelated,
        table?: string,
        foreignPivotKey?: string,
        relatedPivotKey?: string,
        parentKey?: string,
        relatedKey?: string,
    ): BelongsToMany<TRelated, Model<Record<string, unknown>>> {
        const instance = new related();

        // Default pivot table name: alphabetical order of table names joined by underscore
        const relatedTable = instance.getTable();
        const parentTable = this.getTable();
        const resolvedTable =
            table ??
            (() => {
                const tables = [parentTable, relatedTable].sort();
                return `${tables.map((t) => t.replace(/s$/, "")).join("_")}s`;
            })();

        const resolvedForeignPivotKey = foreignPivotKey ?? this.getForeignKey();
        const resolvedRelatedPivotKey =
            relatedPivotKey ??
            `${(instance.constructor as typeof Model).name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()}_id`;
        const resolvedParentKey = parentKey ?? (this.constructor as typeof Model).primaryKey;
        const resolvedRelatedKey = relatedKey ?? (instance.constructor as typeof Model).primaryKey;

        return new BelongsToMany(
            instance.newQuery() as unknown as QueryBuilder<TRelated>,
            this as unknown as Model<Record<string, unknown>>,
            resolvedTable,
            resolvedForeignPivotKey,
            resolvedRelatedPivotKey,
            resolvedParentKey,
            resolvedRelatedKey,
        );
    }

    /**
     * Get the default foreign key name for the model.
     *
     * @returns Foreign key column name (e.g., 'user_id')
     */
    getForeignKey(): string {
        return `${(this.constructor as typeof Model).name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()}_id`;
    }
}
