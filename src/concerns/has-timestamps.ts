import type { Model } from "../model";

/**
 * Constructor type for mixin pattern.
 * Note: Mixin constructors accept unknown arguments and preserve the concrete model type.
 *
 * @template T - The base class type
 */
export type Constructor<T extends Model = Model> = new (...args: unknown[]) => T;
type TimestampedModel = Model & {
    updateTimestamps(): void;
};
type TimestampedConstructor<TBase extends Constructor> = new (
    ...args: ConstructorParameters<TBase>
) => InstanceType<TBase> & TimestampedModel;

/**
 * HasTimestamps mixin handles automatic timestamp management.
 *
 * @template TBase - The base constructor type
 *
 * @example
 * ```typescript
 * class User extends HasTimestamps(Model) {
 *     protected static table = 'users';
 * }
 *
 * const user = new User({ name: 'John' });
 * await user.save(); // Automatically sets created_at and updated_at
 *
 * user.name = 'Jane';
 * await user.save(); // Automatically updates updated_at
 * ```
 */
export function HasTimestamps<TBase extends Constructor>(Base: TBase): TBase & TimestampedConstructor<TBase> {
    const ModelBase = Base as Constructor;

    class HasTimestampsModel extends ModelBase {
        /**
         * Override save to automatically update timestamps.
         *
         * @returns Promise resolving to true if successful
         */
        override async save(): Promise<boolean> {
            this.updateTimestamps();
            return super.save();
        }

        /**
         * Update created_at and updated_at timestamps.
         * Sets created_at only on new records and updated_at on all saves.
         */
        updateTimestamps(): void {
            const now = new Date().toISOString(); // SQLite text format ISO8601

            // Check existence logic.
            // 'exists' property is protected in Model. Mixin should access it via subclassing.
            // TS might complain if definition file doesn't expose it.
            // Assuming we are in same package/compilation context it works.

            if (!this.exists) {
                this.setAttribute("created_at", now);
            }
            this.setAttribute("updated_at", now);
        }
    }

    return HasTimestampsModel as unknown as TBase & TimestampedConstructor<TBase>;
}
