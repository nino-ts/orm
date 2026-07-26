import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HasEvents } from "../../src/concerns/has-events";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";

class User extends HasEvents(Model) {
    protected static override table = "users";
}

describe("Model Events", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        const conn = db.connection();
        await conn.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
    });

    afterEach(async () => {
        // Clear event listeners
        User.clearEventListeners();
        await db.closeALl();
    });

    test("should fire creating event before insert", async () => {
        let eventFired = false;
        User.addEventListener("creating", () => {
            eventFired = true;
        });

        const user = new User({ name: "John" });
        await user.save();

        expect(eventFired).toBe(true);
    });

    test("should fire created event after insert", async () => {
        let eventFired = false;
        User.addEventListener("created", () => {
            eventFired = true;
        });

        const user = new User({ name: "Jane" });
        await user.save();

        expect(eventFired).toBe(true);
    });

    test("should fire updating event before update", async () => {
        const user = new User({ name: "Bob" });
        await user.save();

        let eventFired = false;
        User.addEventListener("updating", () => {
            eventFired = true;
        });

        user.name = "Bob Updated";
        await user.save();

        expect(eventFired).toBe(true);
    });

    test("should fire updated event after update", async () => {
        const user = new User({ name: "Alice" });
        await user.save();

        let eventFired = false;
        User.addEventListener("updated", () => {
            eventFired = true;
        });

        user.name = "Alice Updated";
        await user.save();

        expect(eventFired).toBe(true);
    });

    test("should allow cancelling save by returning false from creating", async () => {
        User.addEventListener("creating", () => false);

        const user = new User({ name: "Test" });
        const result = await user.save();

        expect(result).toBe(false);
        expect(user.id).toBeUndefined();
    });
});
