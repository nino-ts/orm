#!/usr/bin/env bun

/**
 * Script to run tests with Docker databases.
 * Starts containers, waits for healthcheck, runs tests, and tears everything down.
 *
 * Usage: bun run scripts/test-with-db.ts [-- args for bun test]
 */

import process from "node:process";
import { $ } from "bun";

const COMPOSE_FILE = "docker-compose.yml";

async function main() {
    const testArgs = process.argv.slice(2);

    try {
        // Start containers in background
        await $`docker compose -f ${COMPOSE_FILE} up -d --wait`.quiet();

        // Run tests (pass extra args if any)
        const testProcess = Bun.spawn(["bun", "test", ...testArgs], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                MYSQL_URL: "mysql://ninots:ninots@localhost:3306/ninots_test",
                // Environment variables for tests
                POSTGRES_URL: "postgres://ninots:ninots@localhost:5432/ninots_test",
            },
            stdio: ["inherit", "inherit", "inherit"],
        });

        const exitCode = await testProcess.exited;
        await $`docker compose -f ${COMPOSE_FILE} down -v --remove-orphans`.quiet();
        process.exit(exitCode);
    } catch (_error) {
        await $`docker compose -f ${COMPOSE_FILE} down -v --remove-orphans`.quiet();

        process.exit(1);
    }
}

main();
