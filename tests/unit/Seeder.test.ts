import { describe, expect, test } from "bun:test";
import { Seeder } from "../../src/seeder/seeder";
import { SeederRunner } from "../../src/seeder/seeder-runner";

class AlphaSeeder extends Seeder {
    public static runs = 0;

    run(): void {
        AlphaSeeder.runs += 1;
    }
}

class DatabaseSeeder extends Seeder {
    async run(): Promise<void> {
        await this.call(AlphaSeeder);
    }
}

describe("Seeder", () => {
    test("SeederRunner executes root seeder", async () => {
        AlphaSeeder.runs = 0;
        const runner = new SeederRunner(DatabaseSeeder);
        await runner.run();
        expect(AlphaSeeder.runs).toBe(1);
    });

    test("callOnce prevents duplicate seeder execution", async () => {
        AlphaSeeder.runs = 0;
        Seeder.resetCalled();

        class OnceSeeder extends Seeder {
            async run(): Promise<void> {
                await this.callOnce(AlphaSeeder);
                await this.callOnce(AlphaSeeder);
            }
        }

        await new SeederRunner(OnceSeeder).run();
        expect(AlphaSeeder.runs).toBe(1);
    });
});
