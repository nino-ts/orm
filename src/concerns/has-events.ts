import type { Model } from "../model";

/**
 * Constructor type for mixin pattern.
 * Note: Mixin constructors accept unknown arguments and preserve the concrete model type.
 *
 * @template T - The base class type
 */
export type Constructor<T extends Model = Model> = new (...args: unknown[]) => T;
type EventfulModel = Model & {
    fireModelEvent(event: EventName): boolean;
};
type EventfulConstructor<TBase extends Constructor> = (new (
    ...args: ConstructorParameters<TBase>
) => InstanceType<TBase> & EventfulModel) & {
    addEventListener(event: EventName, callback: EventCallback): void;
    clearEventListeners(): void;
};

/**
 * Event callback function type.
 * Return false to prevent the event from continuing.
 */
export type EventCallback = (model: Model) => boolean | undefined;

/**
 * Available model lifecycle event names.
 */
export type EventName =
    | "creating"
    | "created"
    | "updating"
    | "updated"
    | "saving"
    | "saved"
    | "deleting"
    | "deleted"
    | "restoring"
    | "restored";

/**
 * Static event storage per class.
 */
const eventListeners = new Map<string, Map<EventName, EventCallback[]>>();

/**
 * HasEvents mixin adds model lifecycle events.
 *
 * @template TBase - The base constructor type
 *
 * @example
 * ```typescript
 * class User extends HasEvents(Model) {
 *     protected static table = 'users';
 * }
 *
 * User.addEventListener('creating', (user) => {
 *     console.log('Creating user:', user);
 *     // Return false to cancel creation
 * });
 *
 * const user = new User({ name: 'John' });
 * await user.save(); // Fires creating, saving, created, saved events
 * ```
 */
export function HasEvents<TBase extends Constructor>(Base: TBase): TBase & EventfulConstructor<TBase> {
    const ModelBase = Base as Constructor;

    class HasEventsModel extends ModelBase {
        /**
         * Add an event listener for a lifecycle event.
         *
         * @param event - Event name
         * @param callback - Callback function
         *
         * @example
         * ```typescript
         * User.addEventListener('saving', (user) => {
         *     console.log('Saving user:', user);
         * });
         * ```
         */
        static addEventListener(event: EventName, callback: EventCallback): void {
            const className =
                this.name;
            if (!eventListeners.has(className)) {
                eventListeners.set(className, new Map());
            }
            const listeners = eventListeners.get(className);
            if (!listeners) {
                throw new Error(`Failed to initialize event listeners for ${className}`);
            }
            if (!listeners.has(event)) {
                listeners.set(event, []);
            }
            listeners.get(event)?.push(callback);
        }

        /**
         * Clear all event listeners (useful for tests).
         *
         * @example
         * ```typescript
         * User.clearEventListeners();
         * ```
         */
        static clearEventListeners(): void {
            eventListeners.delete(
                this.name,
            );
        }

        /**
         * Fire a model event.
         *
         * @param event - Event name to fire
         * @returns false if any listener returns false, true otherwise
         *
         * @example
         * ```typescript
         * if (!this.fireModelEvent('saving')) {
         *     return false; // Event cancelled
         * }
         * ```
         */
        protected fireModelEvent(event: EventName): boolean {
            const className = this._modelClass?.name || this.constructor.name;
            const listeners = eventListeners.get(className)?.get(event);
            if (!listeners) {
                return true;
            }

            for (const callback of listeners) {
                const result = callback(this as unknown as Model);
                if (result === false) {
                    return false;
                }
            }
            return true;
        }

        /**
         * Override save to fire lifecycle events.
         *
         * @returns Promise resolving to true if successful, false if cancelled
         */
        override async save(): Promise<boolean> {
            const isCreating = !this.exists;

            // Fire saving event
            if (!this.fireModelEvent("saving")) {
                return false;
            }

            // Fire creating/updating event
            if (isCreating) {
                if (!this.fireModelEvent("creating")) {
                    return false;
                }
            } else {
                if (!this.fireModelEvent("updating")) {
                    return false;
                }
            }

            // Call parent save
            const result = await super.save();

            if (result) {
                // Fire created/updated event
                if (isCreating) {
                    this.fireModelEvent("created");
                } else {
                    this.fireModelEvent("updated");
                }

                // Fire saved event
                this.fireModelEvent("saved");
            }

            return result;
        }
    }

    return HasEventsModel as unknown as TBase & EventfulConstructor<TBase>;
}
