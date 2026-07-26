import { describe, expect, test } from "bun:test";
import { Column } from "../../src/decorators/column";
import { Table } from "../../src/decorators/table";
import { Model } from "../../src/model";

// TS 5.x Decorator Usage
@Table("custom_users")
class User extends Model {
    @Column("full_name")
    name: string;
}

describe("Decorators", () => {
    test("@Table decorator should set table name", () => {
        expect(User.getTable()).toBe("custom_users");
    });

    test("@Column decorator should map property to database column", () => {
        const user = new User();
        user.name = "Alice";

        // Internal mapping metadata should exist
        expect((User as unknown as { __columnMapping: Record<string, string> }).__columnMapping).toBeDefined();
        expect((User as unknown as { __columnMapping: Record<string, string> }).__columnMapping.name).toBe("full_name");
    });

    test("@Column decorator should work with multiple properties", () => {
        @Table("test_users")
        class TestUser extends Model {
            @Column("first_name")
            firstName: string;

            @Column("last_name")
            lastName: string;

            @Column("email_address")
            email: string;
        }

        // Stage 3 decorators use addInitializer, which runs when instance is created
        void new TestUser();

        const mapping = (TestUser as unknown as { __columnMapping: Record<string, string> }).__columnMapping;
        expect(mapping.firstName).toBe("first_name");
        expect(mapping.lastName).toBe("last_name");
        expect(mapping.email).toBe("email_address");
    });

    test("@Table decorator should work without explicit context", () => {
        class SimpleUser extends Model {}
        const TableDecorator = Table("simple_table");
        TableDecorator(SimpleUser, undefined as unknown as ClassFieldDecoratorContext);

        expect((SimpleUser as unknown as { table: string }).table).toBe("simple_table");
    });

    test("@Column decorator standard support (Stage 3)", () => {
        // Test standard decorator path with addInitializer
        const propertyName = "testProp";
        const columnName = "test_column";

        class TestModel extends Model {}
        const instance = new TestModel() as unknown as Record<string, unknown>;

        const decorator = Column(columnName);
        const context = {
            addInitializer(fn: (this: unknown) => void) {
                fn.call(instance);
            },
            name: propertyName,
        } as ClassFieldDecoratorContext;

        decorator({}, context);

        expect(instance.constructor.__columnMapping).toBeDefined();
        expect(instance.constructor.__columnMapping[propertyName]).toBe(columnName);
    });
});
