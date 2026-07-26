/**
 * Base database seeder — mirrors Laravel's Illuminate\Database\Seeder.
 */
export abstract class Seeder {
    private static calledSeeders = new Set<string>();

    /**
     * Run the database seeds.
     */
    abstract run(): Promise<void> | void;

    /**
     * Run another seeder class.
     */
    async call(seeder: new () => Seeder): Promise<void> {
        const instance = new seeder();
        await instance.run();
        Seeder.calledSeeders.add(seeder.name);
    }

    /**
     * Run another seeder class without console output (parity hook).
     */
    async callSilent(seeder: new () => Seeder): Promise<void> {
        await this.call(seeder);
    }

    /**
     * Run a seeder only once per process.
     */
    async callOnce(seeder: new () => Seeder): Promise<void> {
        if (Seeder.calledSeeders.has(seeder.name)) {
            return;
        }
        await this.call(seeder);
    }

    /**
     * Reset called seeder tracking (for tests).
     */
    static resetCalled(): void {
        Seeder.calledSeeders.clear();
    }
}
