import type { Model } from "../model";
import type { ModelConstructor } from "../types";

/**
 * State callback applied during factory attribute resolution.
 */
export type FactoryStateCallback<TAttributes extends object> = (
    attributes: TAttributes,
) => Partial<TAttributes>;

/**
 * Queued child factory for `has()` relationships.
 */
interface ChildFactorySpec {
    readonly factory: Factory<Model>;
    readonly foreignKey: string;
    readonly localKey: string;
    readonly count: number;
}

type FactoryCount = number | null;

/**
 * Infer create/make result from factory count.
 */
export type FactoryResult<TModel extends Model, TCount extends FactoryCount> = TCount extends number
    ? TCount extends 1
        ? TModel
        : TModel[]
    : TModel;

/**
 * Eloquent-style model factory with typed attributes and fluent API.
 */
export abstract class Factory<
    TModel extends Model = Model,
    TAttributes extends object = Record<string, unknown>,
    TCount extends FactoryCount = null,
> {
    protected countValue: TCount = null as TCount;
    protected states: FactoryStateCallback<TAttributes>[] = [];
    protected children: ChildFactorySpec[] = [];

    /**
     * Default attribute definition for the model.
     */
    abstract definition(): TAttributes;

    /**
     * Model class produced by this factory.
     */
    abstract model(): ModelConstructor<TModel>;

    /**
     * Create a new factory instance.
     */
    static new<T extends Factory>(this: new () => T): T {
        return new this();
    }

    protected clone(): this {
        const cloned = Object.create(Object.getPrototypeOf(this)) as this;
        cloned.countValue = this.countValue;
        cloned.states = [...this.states];
        cloned.children = [...this.children];
        return cloned;
    }

    /**
     * Set how many models should be created.
     */
    count<TAmount extends number>(
        this: Factory<TModel, TAttributes, TCount>,
        amount: TAmount,
    ): Factory<TModel, TAttributes, TAmount> {
        const cloned = this.clone() as unknown as Factory<TModel, TAttributes, TAmount>;
        cloned.countValue = amount as TAmount;
        return cloned;
    }

    /**
     * Apply state overrides to the generated attributes.
     */
    state(
        state: Partial<TAttributes> | FactoryStateCallback<TAttributes>,
    ): Factory<TModel, TAttributes, TCount> {
        const cloned = this.clone();
        if (typeof state === "function") {
            cloned.states.push(state);
        } else {
            cloned.states.push(() => state);
        }
        return cloned;
    }

    /**
     * Create related models after the parent is persisted.
     */
    has<TChild extends Model>(
        factory: Factory<TChild>,
        foreignKey?: string,
        localKey = "id",
    ): Factory<TModel, TAttributes, TCount> {
        const cloned = this.clone();
        const childModel = factory.model();
        const table = childModel.getTable();
        const inferredForeignKey = foreignKey ?? `${singularize(table)}_id`;

        cloned.children.push({
            count: factory.countValue ?? 1,
            factory,
            foreignKey: inferredForeignKey,
            localKey,
        });
        return cloned;
    }

  /**
   * Build model instances without persisting.
   */
    async make(overrides: Partial<TAttributes> = {}): Promise<FactoryResult<TModel, TCount>> {
        const amount = this.countValue ?? 1;
        const models: TModel[] = [];

        for (let index = 0; index < amount; index++) {
            const attributes = this.resolveAttributes(overrides);
            const ModelClass = this.model();
            const instance = new ModelClass();
            instance.fill(attributes);
            models.push(instance);
        }

        if (amount === 1) {
            return models[0]! as FactoryResult<TModel, TCount>;
        }

        return models as FactoryResult<TModel, TCount>;
    }

    /**
     * Persist model instance(s) to the database.
     */
    async create(overrides: Partial<TAttributes> = {}): Promise<FactoryResult<TModel, TCount>> {
        const made = await this.make(overrides);
        const models = Array.isArray(made) ? made : [made];

        for (const model of models) {
            await model.save();
            await this.createChildren(model);
        }

        return made;
    }

    protected resolveAttributes(overrides: Partial<TAttributes>): Partial<TAttributes> {
        let attributes: TAttributes = { ...this.definition() };

        for (const stateFn of this.states) {
            attributes = { ...attributes, ...stateFn(attributes) };
        }

        return { ...attributes, ...overrides };
    }

    protected async createChildren(parent: TModel): Promise<void> {
        for (const child of this.children) {
            for (let index = 0; index < child.count; index++) {
                const localValue = parent.getAttribute(child.localKey);
                await child.factory.create({
                    [child.foreignKey]: localValue,
                } as Record<string, unknown>);
            }
        }
    }
}

/**
 * Register `Model.factory()` pointing at a factory class.
 */
export function configureModelFactory<TModel extends Model, TFactory extends { count(amount: number): unknown }>(
    model: ModelConstructor<TModel>,
    factoryClass: new () => TFactory,
): void {
    const modelWithFactory = model as ModelConstructor<TModel> & {
        factory(count?: number): TFactory;
    };

    modelWithFactory.factory = (count?: number): TFactory => {
        const instance = new factoryClass();
        if (count !== undefined) {
            return instance.count(count) as TFactory;
        }
        return instance;
    };
}

function singularize(table: string): string {
    if (table.endsWith("ies")) {
        return `${table.slice(0, -3)}y`;
    }
    if (table.endsWith("s")) {
        return table.slice(0, -1);
    }
    return table;
}
