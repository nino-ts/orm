import type { Model } from "../model";
import type { QueryBuilder } from "../query-builder";

/**
 * Constructor type for mixin pattern.
 * Note: Mixin constructors accept unknown arguments and preserve the concrete model type.
 *
 * @template T - The base class type
 */
export type Constructor<T extends Model = Model> = new (...args: unknown[]) => T;
type SoftDeletingModel = Model<Record<string, unknown>> & {
    newQueryWithoutScopes(): QueryBuilder<Model<Record<string, unknown>>>;
};
type SoftDeletesConstructor<TBase extends Constructor> = TBase & {
    withTrashed(): QueryBuilder<Model<Record<string, unknown>>>;
};

/**
 * SoftDeletes mixin handles soft deletion of models.
 *
 * @template TBase - The base constructor type
 *
 * @example
 * ```typescript
 * class User extends SoftDeletes(Model) {
 *     protected static table = 'users';
 * }
 *
 * const user = await User.find(1);
 * await user.delete(); // Soft delete (sets deleted_at)
 *
 * // Query with soft-deleted records
 * const allUsers = await User.withTrashed().get();
 * ```
 */
export function SoftDeletes<TBase extends Constructor>(Base: TBase): SoftDeletesConstructor<TBase> {
    const ModelBase = Base as Constructor;

    class SoftDeletesModel extends ModelBase {
        /**
         * Soft delete the model by setting deleted_at timestamp.
         *
         * @returns Promise resolving to true if successful
         */
        override async delete(): Promise<boolean> {
            this.setAttribute("deleted_at", new Date().toISOString());
            return this.save();
        }

        /**
         * Override newQuery to apply global scope excluding soft-deleted records.
         *
         * @returns QueryBuilder instance with soft delete scope
         */
        override newQuery(): QueryBuilder<Model<Record<string, unknown>>> {
            const builder = super.newQuery() as unknown as QueryBuilder<Model<Record<string, unknown>>>;
            builder.whereNull("deleted_at");
            return builder;
        }

        /**
         * Get a new query builder that includes soft-deleted records.
         *
         * @returns QueryBuilder instance without soft delete scope
         *
         * @example
         * ```typescript
         * const allUsers = await User.withTrashed().get();
         * ```
         */
        static withTrashed(): QueryBuilder<Model<Record<string, unknown>>> {
            const Ctor =
                this as unknown as new () => SoftDeletingModel;
            return new Ctor().newQueryWithoutScopes();
        }

        /**
         * Get a new query builder without applying the soft delete scope.
         *
         * @returns QueryBuilder instance without scopes
         */
        newQueryWithoutScopes(): QueryBuilder<Model<Record<string, unknown>>> {
            return super.newQuery() as unknown as QueryBuilder<Model<Record<string, unknown>>>;
        }
    }

    return SoftDeletesModel as unknown as SoftDeletesConstructor<TBase>;
}
