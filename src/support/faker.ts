/**
 * Lightweight fake data helpers — zero external runtime dependencies.
 */

const FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Avery"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];
const DOMAINS = ["example.com", "ninots.test", "mail.test"];

function randomInt(max: number): number {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0]! % max;
}

function randomChars(length: number, alphabet: string): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let result = "";
    for (let i = 0; i < length; i++) {
        result += alphabet[bytes[i]! % alphabet.length];
    }
    return result;
}

/**
 * Create a function that returns unique values from a generator.
 */
export function unique<T>(generator: () => T): () => T {
    const seen = new Set<string>();
    return (): T => {
        for (let attempt = 0; attempt < 100; attempt++) {
            const value = generator();
            const key = typeof value === "string" ? value : JSON.stringify(value);
            if (!seen.has(key)) {
                seen.add(key);
                return value;
            }
        }
        return generator();
    };
}

export const fake = {
    uuid(): string {
        return crypto.randomUUID();
    },

    name(): string {
        const first = FIRST_NAMES[randomInt(FIRST_NAMES.length)]!;
        const last = LAST_NAMES[randomInt(LAST_NAMES.length)]!;
        return `${first} ${last}`;
    },

    firstName(): string {
        return FIRST_NAMES[randomInt(FIRST_NAMES.length)]!;
    },

    lastName(): string {
        return LAST_NAMES[randomInt(LAST_NAMES.length)]!;
    },

    email(): string {
        const local = randomChars(8, "abcdefghijklmnopqrstuvwxyz0123456789");
        const domain = DOMAINS[randomInt(DOMAINS.length)]!;
        return `${local}@${domain}`;
    },

    uniqueEmail: unique((): string => fake.email()),

    password(plain = "password"): string {
        return Bun.password.hashSync(plain, "bcrypt");
    },

    randomString(length = 10): string {
        return randomChars(length, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    },

    boolean(): boolean {
        return randomInt(2) === 1;
    },

    date(): Date {
        const now = Date.now();
        const offset = randomInt(365 * 24 * 60 * 60 * 1000);
        return new Date(now - offset);
    },
};
