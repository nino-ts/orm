import type { ColumnMapping, Model } from "../model";

/**
 * Type for model instance with column mapping metadata.
 */
interface ModelInstanceWithMapping extends Model {
    constructor: {
        __columnMapping?: ColumnMapping;
    };
}

/**
 * Column decorator to map a property name to a database column name.
 *
 * @param name - The database column name
 * @returns Decorator function
 *
 * @example
 * ```typescript
 * class User extends Model {
 *     @Column('first_name')
 *     firstName!: string;
 *
 *     @Column('last_name')
 *     lastName!: string;
 * }
 *
 * const user = new User();
 * user.firstName = 'John'; // Maps to 'first_name' column
 * ```
 */
export function Column(name: string) {
    return (target: object | undefined, context: string | ClassFieldDecoratorContext): void => {
        // Legacy Decorator Support (TypeScript legacy decorators)
        if (typeof context === "string") {
            const propertyKey = context;
            const targetWithMapping = target as ModelInstanceWithMapping;

            if (!targetWithMapping.constructor.__columnMapping) {
                Object.defineProperty(targetWithMapping.constructor, "__columnMapping", {
                    configurable: true,
                    enumerable: false,
                    value: {},
                    writable: true,
                });
            }
            if (targetWithMapping.constructor.__columnMapping) {
                targetWithMapping.constructor.__columnMapping[propertyKey] = name;
            }
            return;
        }

        // Standard Decorator Support (Stage 3)
        const ctx = context as ClassFieldDecoratorContext;
        const propName = String(ctx.name);

        // Stage 3 Field Decorators: Use addInitializer to register on the constructor
        // The 'this' context in addInitializer is the instance, so we access its constructor
        ctx.addInitializer(function (this: unknown) {
            const instance = this as ModelInstanceWithMapping;
            const constructor = instance.constructor as ModelInstanceWithMapping["constructor"];

            if (!constructor.__columnMapping) {
                Object.defineProperty(constructor, "__columnMapping", {
                    configurable: true,
                    enumerable: false,
                    value: {},
                    writable: true,
                });
            }

            if (constructor.__columnMapping) {
                constructor.__columnMapping[propName] = name;
            }
        });
    };
}
