import { Connection } from "./connection";
import type { ConnectionConfig } from "./types";

/**
 * The DatabaseManager class manages database connections.
 * It acts as a factory and registry for Connection instances.
 */
export class DatabaseManager {
    protected connections: Map<string, Connection> = new Map();
    protected configs: Map<string, ConnectionConfig> = new Map();
    protected defaultConnection: string = "default";

    /**
     * Register a connection configuration.
     * @param name Connection name
     * @param config Connection configuration
     */
    addConnection(name: string, config: ConnectionConfig): void {
        this.configs.set(name, config);
    }

    /**
     * Get a connection instance.
     * @param name Connection name (optional, defaults to default connection)
     */
    connection(name?: string): Connection {
        const connectionName = name || this.defaultConnection;

        const existingConnection = this.connections.get(connectionName);
        if (existingConnection) {
            return existingConnection;
        }

        const config = this.configs.get(connectionName);
        if (!config) {
            throw new Error(`Database connection [${connectionName}] not configured.`);
        }

        const connection = new Connection(config);
        this.connections.set(connectionName, connection);

        return connection;
    }

    /**
     * Set the default connection name.
     * @param name Connection name
     */
    setDefaultConnection(name: string): void {
        this.defaultConnection = name;
    }

    /**
     * Get the default connection name.
     */
    getDefaultConnection(): string {
        return this.defaultConnection;
    }

    /**
     * Close all active connections.
     */
    async closeALl(): Promise<void> {
        for (const connection of this.connections.values()) {
            await connection.close();
        }
        this.connections.clear();
    }
}
