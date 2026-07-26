import type { Connection } from "./connection";

/**
 * Database migration contract — `up` applies, `down` reverses.
 */
export interface Migration {
    up(connection: Connection): Promise<void>;
    down(connection: Connection): Promise<void>;
}
