import type { Seeder } from "./seeder";

/**
 * Execute a root database seeder class.
 */
export class SeederRunner {
    constructor(private readonly seederClass: new () => Seeder) {}

    async run(): Promise<void> {
        const seeder = new this.seederClass();
        await seeder.run();
    }
}
