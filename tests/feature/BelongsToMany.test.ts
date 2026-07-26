import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DatabaseManager } from "../../src/database-manager";
import { Model } from "../../src/model";

class User extends Model {
    protected static override table = "users";

    roles() {
        return this.belongsToMany(Role, "user_roles", "user_id", "role_id");
    }
}

class Role extends Model {
    protected static override table = "roles";

    users() {
        return this.belongsToMany(User, "user_roles", "role_id", "user_id");
    }
}

describe("BelongsToMany", () => {
    let db: DatabaseManager;

    beforeEach(async () => {
        db = new DatabaseManager();
        db.addConnection("default", { driver: "sqlite", url: ":memory:" });
        db.setDefaultConnection("default");
        Model.setConnectionResolver(db);

        const conn = db.connection();
        await conn.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
        await conn.run("CREATE TABLE roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
        await conn.run("CREATE TABLE user_roles (user_id INTEGER, role_id INTEGER, PRIMARY KEY(user_id, role_id))");

        // Seed
        await conn.run("INSERT INTO users (name) VALUES (?)", ["Alice"]);
        await conn.run("INSERT INTO roles (name) VALUES (?)", ["Admin"]);
        await conn.run("INSERT INTO roles (name) VALUES (?)", ["Editor"]);
        await conn.run("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [1, 1]);
        await conn.run("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [1, 2]);
    });

    afterEach(async () => {
        await db.closeALl();
    });

    test("belongsToMany should return related models via pivot table", async () => {
        const user = (await User.query().first()) as User;
        const roles = await user.roles().get();

        expect(roles.count()).toBe(2);
        expect(roles.pluck("name").all()).toEqual(["Admin", "Editor"]);
    });

    test("belongsToMany should work in reverse", async () => {
        const role = (await Role.query().first()) as Role;
        const users = await role.users().get();

        expect(users.count()).toBe(1);
        expect(users.first()?.name).toBe("Alice");
    });
});
