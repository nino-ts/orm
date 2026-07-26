import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";

class User extends Model {
    protected static override table = "users";

    // Accessor: get{Attribute}Attribute
    getFullNameAttribute(): string {
        return `${this.getAttribute("first_name")} ${this.getAttribute("last_name")}`;
    }

    // Mutator: set{Attribute}Attribute
    setPasswordAttribute(value: string): void {
        this.attributes.password = `hashed_${value}`;
    }
}

describe("Accessors and Mutators", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        const conn = db.connection();
        await conn.run(
            "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, password TEXT)",
        );
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("accessor should compute virtual attribute", () => {
        const user = new User({ first_name: "John", last_name: "Doe" });

        // Access via property should trigger accessor
        expect(user.full_name).toBe("John Doe");
    });

    test("mutator should transform value before setting", () => {
        const user = new User();

        // Setting password should trigger mutator
        user.password = "secret123";

        expect(user.getAttribute("password")).toBe("hashed_secret123");
    });

    test("accessor should work with database data", async () => {
        const conn = db.connection();
        await conn.run("INSERT INTO users (first_name, last_name) VALUES (?, ?)", ["Jane", "Smith"]);

        const user = (await User.query().first()) as User;

        expect(user.full_name).toBe("Jane Smith");
    });
});
