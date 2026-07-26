/**
 * Transaction management utilities.
 *
 * Provides convenient abstraction over Connection.begin() for transaction handling.
 * Uses Bun SQL's native transaction support with automatic rollback on error.
 *
 * @packageDocumentation
 */

import type { Connection } from "./connection";
import type { IsolationLevel, WhereClauseValue } from "./types";

/**
 * Transaction state.
 */
export type TransactionState = "active" | "committed" | "rolled_back";

/**
 * Transaction execution result with metadata.
 */
export interface TransactionResult<T> {
    readonly result: T;
    readonly committed: boolean;
}

/**
 * Transaction options.
 */
export interface TransactionOptions {
    /**
     * Isolation level for the transaction.
     *
     * @default 'READ COMMITTED'
     */
    readonly isolationLevel?: IsolationLevel;

    /**
     * Maximum retry attempts on deadlock/serialization errors.
     *
     * @default 0 (no retries)
     */
    readonly maxRetries?: number;
}

/**
 * Transaction class providing a convenient API over Connection.begin().
 *
 * **Recommended Usage**: Use Connection.begin() directly with callback API:
 *
 * @example
 * ```typescript
 * // Recommended: Callback API (uses Bun SQL native)
 * await connection.begin(async (tx) => {
 *     await tx.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
 *     await tx.run('UPDATE accounts SET balance = balance - ?', [100]);
 *     // Auto-commit on success, auto-rollback on error
 * });
 * ```
 *
 * **Legacy Usage**: Object-oriented API (compatibility):
 *
 * @example
 * ```typescript
 * // Legacy: Manual control (for compatibility)
 * const tx = await Transaction.begin(conn);
 * try {
 *     await tx.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
 *     await tx.commit();
 * } catch (error) {
 *     await tx.rollback();
 *     throw error;
 * }
 * ```
 *
 * **Disposable Pattern**:
 *
 * @example
 * ```typescript
 * // Using TypeScript 'using' keyword (auto-rollback)
 * {
 *     using tx = await Transaction.begin(conn);
 *     await tx.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
 *     await tx.commit(); // Explicit commit required
 * } // Auto-rollback if not committed
 * ```
 */
export class Transaction implements AsyncDisposable {
    /**
     * Transaction state.
     */
    private state: TransactionState = "active";

    /**
     * Wrapped connection instance.
     */
    private readonly connection: Connection;

    /**
     * Private constructor - use Transaction.begin() instead.
     *
     * @param connection - Database connection
     */
    private constructor(connection: Connection) {
        this.connection = connection;
    }

    /**
     * Begin a new transaction.
     *
     * Executes BEGIN statement immediately to start the transaction.
     *
     * @param connection - Database connection
     * @param options - Transaction options
     * @returns Transaction instance
     *
     * @example
     * ```typescript
     * const tx = await Transaction.begin(conn);
     * await tx.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
     * await tx.commit();
     * ```
     */
    static async begin(connection: Connection, options?: TransactionOptions): Promise<Transaction> {
        const tx = new Transaction(connection);

        // Execute BEGIN to start the transaction
        await connection.run("BEGIN");

        // Set isolation level if specified
        if (options?.isolationLevel) {
            await connection.run(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
        }

        return tx;
    }

    /**
     * Execute a transaction with automatic commit/rollback.
     *
     * This is a convenience wrapper around Connection.begin() that provides
     * a cleaner API. Uses Bun SQL's native transaction management.
     *
     * @template T - Return type of the callback
     * @param connection - Database connection
     * @param callback - Transaction callback
     * @param options - Transaction options
     * @returns Transaction result
     *
     * @example
     * ```typescript
     * const result = await Transaction.execute(conn, async (tx) => {
     *     const user = await tx.query('SELECT * FROM users WHERE id = ?', [1]);
     *     await tx.run('UPDATE users SET active = ? WHERE id = ?', [true, 1]);
     *     return user;
     * });
     * ```
     */
    static async execute<T>(
        connection: Connection,
        callback: (tx: Connection) => Promise<T>,
        options?: TransactionOptions,
    ): Promise<TransactionResult<T>> {
        let retries = 0;
        const maxRetries = options?.maxRetries ?? 0;

        while (true) {
            try {
                // Set isolation level if specified
                if (options?.isolationLevel) {
                    await connection.run(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
                }

                // Use Connection.begin() which leverages Bun SQL native transactions
                const result = await connection.begin(callback);

                return {
                    committed: true,
                    result,
                };
            } catch (error) {
                // Retry on deadlock/serialization errors
                if (
                    retries < maxRetries &&
                    error instanceof Error &&
                    (error.message.includes("deadlock") || error.message.includes("serialization"))
                ) {
                    retries++;
                    // Exponential backoff
                    await new Promise((resolve) => setTimeout(resolve, 2 ** retries * 100));
                    continue;
                }

                throw error;
            }
        }
    }

    /**
     * Execute a SQL query within this transaction.
     *
     * @template T - Result row type
     * @param sql - SQL query
     * @param bindings - Query bindings
     * @returns Query results
     */
    async query<T = unknown>(sql: string, bindings: readonly WhereClauseValue[] = []): Promise<T[]> {
        this.assertActive();
        return this.connection.query<T>(sql, bindings);
    }

    /**
     * Execute a SQL statement within this transaction.
     *
     * @param sql - SQL statement
     * @param bindings - Query bindings
     * @returns Statement result
     */
    async run(
        sql: string,
        bindings: readonly WhereClauseValue[] = [],
    ): Promise<{
        readonly lastInsertId: number | string | null;
        readonly changes: number;
    }> {
        this.assertActive();
        return this.connection.run(sql, bindings);
    }

    /**
     * Commit the transaction.
     *
     * Note: When using Connection.begin() callback API, commit is automatic.
     * This method is for manual transaction control only.
     */
    async commit(): Promise<void> {
        if (this.state !== "active") {
            return;
        }

        await this.connection.run("COMMIT");
        this.state = "committed";
    }

    /**
     * Rollback the transaction.
     *
     * Note: When using Connection.begin() callback API, rollback is automatic on error.
     * This method is for manual transaction control only.
     */
    async rollback(): Promise<void> {
        if (this.state !== "active") {
            return;
        }

        await this.connection.run("ROLLBACK");
        this.state = "rolled_back";
    }

    /**
     * Create a savepoint within the transaction.
     *
     * Savepoints allow partial rollback of transaction work.
     *
     * @param name - Savepoint name
     *
     * @example
     * ```typescript
     * await tx.savepoint('before_update');
     * await tx.run('UPDATE users SET active = false');
     * await tx.rollbackTo('before_update'); // Undo the update
     * ```
     */
    async savepoint(name: string): Promise<void> {
        this.assertActive();
        await this.connection.run(`SAVEPOINT ${name}`);
    }

    /**
     * Rollback to a specific savepoint.
     *
     * @param name - Savepoint name
     */
    async rollbackTo(name: string): Promise<void> {
        this.assertActive();
        await this.connection.run(`ROLLBACK TO SAVEPOINT ${name}`);
    }

    /**
     * Release a savepoint (commits its changes).
     *
     * @param name - Savepoint name
     */
    async releaseSavepoint(name: string): Promise<void> {
        this.assertActive();
        await this.connection.run(`RELEASE SAVEPOINT ${name}`);
    }

    /**
     * Check if transaction is currently active.
     */
    get isActive(): boolean {
        return this.state === "active";
    }

    /**
     * Check if transaction was committed.
     */
    get isCommitted(): boolean {
        return this.state === "committed";
    }

    /**
     * Check if transaction was rolled back.
     */
    get isRolledBack(): boolean {
        return this.state === "rolled_back";
    }

    /**
     * Get current transaction state.
     */
    get currentState(): TransactionState {
        return this.state;
    }

    /**
     * AsyncDisposable implementation - auto-rollback if not committed.
     *
     * Used with TypeScript 'using' keyword for automatic cleanup.
     */
    async [Symbol.asyncDispose](): Promise<void> {
        if (this.state === "active") {
            await this.rollback();
        }
    }

    /**
     * Assert transaction is active, throw error otherwise.
     */
    private assertActive(): void {
        if (this.state !== "active") {
            throw new Error(`Transaction is ${this.state}, cannot execute queries`);
        }
    }
}

/**
 * Helper function for executing a transaction with automatic commit/rollback.
 *
 * Convenience wrapper around Connection.begin() for functional style.
 *
 * @template T - Result type
 * @param connection - Database connection
 * @param callback - Transaction callback
 * @param options - Transaction options
 * @returns Result from callback
 *
 * @example
 * ```typescript
 * const userId = await transaction(conn, async (tx) => {
 *     const result = await tx.run(
 *         'INSERT INTO users (name) VALUES (?)',
 *         ['Alice']
 *     );
 *     return result.lastInsertId;
 * });
 * ```
 */
export async function transaction<T>(
    connection: Connection,
    callback: (tx: Connection) => Promise<T>,
    options?: TransactionOptions,
): Promise<T> {
    const result = await Transaction.execute(connection, callback, options);
    return result.result;
}
