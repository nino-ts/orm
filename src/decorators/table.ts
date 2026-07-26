/**
 * Type for class constructor with table property.
 */
interface ModelConstructorWithTable {
    table: string;
}

/**
 * Table decorator to specify the database table name for a model.
 *
 * @param name - The table name
 * @returns Decorator function
 *
 * @example
 * ```typescript
 * @Table('users')
 * class User extends Model {
 *     // ...
 * }
 * ```
 */
export function Table(name: string) {
    return (target: object, context?: ClassDecoratorContext): void => {
        // Legacy Support (target is Constructor)
        if (typeof target === "function" && (!context || typeof context === "undefined")) {
            (target as unknown as ModelConstructorWithTable).table = name;
            return;
        }

        // Standard Support
        if (context) {
            context.addInitializer(function (this: unknown) {
                (this as ModelConstructorWithTable).table = name;
            });
        }
    };
}
