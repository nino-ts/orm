/** JSR graph shim for bun:sqlite. */
export class Database {
	constructor(..._args: unknown[]) {}
	close(): void {}
	query(_sql: string): { all: (...a: unknown[]) => unknown[]; get: (...a: unknown[]) => unknown; run: (...a: unknown[]) => unknown } {
		return { all: () => [], get: () => undefined, run: () => ({}) };
	}
}