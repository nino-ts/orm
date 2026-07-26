import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";

class User extends Model {
    protected static override table = "users";

    profile() {
        return this.hasOne(Profile, "user_id", "id");
    }
}

class Profile extends Model {
    protected static override table = "profiles";

    user() {
        return this.belongsTo(User, "user_id", "id");
    }
}

describe("HasOne", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        const conn = db.connection();
        await conn.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
        await conn.run("CREATE TABLE profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, bio TEXT)");

        // Seed
        await conn.run("INSERT INTO users (name) VALUES (?)", ["Alice"]);
        await conn.run("INSERT INTO profiles (user_id, bio) VALUES (?, ?)", [1, "Developer"]);
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("hasOne should return single related model", async () => {
        const user = (await User.query().first()) as User;
        const profile = await user.profile().first();

        expect(profile).not.toBeNull();
        expect(profile?.bio).toBe("Developer");
    });

    test("hasOne should return null if no related model", async () => {
        const conn = db.connection();
        await conn.run("INSERT INTO users (name) VALUES (?)", ["Bob"]);

        const bob = (await User.query().where("name", "=", "Bob").first()) as User;
        const profile = await bob.profile().first();

        expect(profile).toBeNull();
    });
});
