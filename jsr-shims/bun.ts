/** JSR graph shim only — npm tarball keeps Bun built-ins. */
export class SQL {
	constructor(..._args: unknown[]) {}
	close(): void {}
	async begin<T>(_fn: (tx: SQL) => Promise<T>): Promise<T> {
		throw new Error("Bun runtime required");
	}
}

export class Database {
	constructor(..._args: unknown[]) {}
	close(): void {}
	query(_sql: string): { all: (...args: unknown[]) => unknown[]; get: (...args: unknown[]) => unknown; run: (...args: unknown[]) => unknown } {
		return { all: () => [], get: () => undefined, run: () => ({}) };
	}
}