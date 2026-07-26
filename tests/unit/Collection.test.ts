import { describe, expect, test } from "bun:test";
import { Collection } from "../../src/collection";

describe("Collection", () => {
    const items = [
        { active: true, age: 25, id: 1, name: "Alice" },
        { active: false, age: 30, id: 2, name: "Bob" },
        { active: true, age: 25, id: 3, name: "Charlie" },
    ];

    test("should be iterable", () => {
        const collection = new Collection(items);
        const result = [];
        for (const item of collection) {
            result.push(item);
        }
        expect(result).toEqual(items);
    });

    test("all() should return all items", () => {
        const collection = new Collection(items);
        expect(collection.all()).toEqual(items);
    });

    test("count() should return number of items", () => {
        const collection = new Collection(items);
        expect(collection.count()).toBe(3);
    });

    test("first() should return first item", () => {
        const collection = new Collection(items);
        expect(collection.first()).toEqual(items[0]);
    });

    test("first() should return null if empty", () => {
        const collection = new Collection([]);
        expect(collection.first()).toBeNull();
    });

    test("last() should return last item", () => {
        const collection = new Collection(items);
        expect(collection.last()).toEqual(items[2]);
    });

    test("map() should return new collection with mapped items", () => {
        const collection = new Collection(items);
        const mapped = collection.map((item) => item.name);
        expect(mapped).toBeInstanceOf(Collection);
        expect(mapped.all()).toEqual(["Alice", "Bob", "Charlie"]);
    });

    test("filter() should return new collection with filtered items", () => {
        const collection = new Collection(items);
        const filtered = collection.filter((item) => item.age > 25);
        expect(filtered).toBeInstanceOf(Collection);
        expect(filtered.count()).toBe(1);
        expect(filtered.first()).toEqual(items[1]);
    });

    test("pluck() should extract values by key", () => {
        const collection = new Collection(items);
        expect(collection.pluck("name").all()).toEqual(["Alice", "Bob", "Charlie"]);
    });

    test("sum() should calculate sum of numeric field", () => {
        const collection = new Collection(items);
        expect(collection.sum("age")).toBe(80);
    });

    test("avg() should calculate average of numeric field", () => {
        const collection = new Collection([{ val: 10 }, { val: 20 }, { val: 30 }]);
        expect(collection.avg("val")).toBe(20);
    });

    test("min() should calculate min of numeric field", () => {
        const collection = new Collection([{ val: 10 }, { val: 20 }, { val: 5 }]);
        expect(collection.min("val")).toBe(5);
    });

    test("max() should calculate max of numeric field", () => {
        const collection = new Collection([{ val: 10 }, { val: 20 }, { val: 5 }]);
        expect(collection.max("val")).toBe(20);
    });

    test("unique() should remove duplicates by key", () => {
        const collection = new Collection(items);
        const unique = collection.unique("age");
        expect(unique.count()).toBe(2);
        expect(unique.pluck("age").all()).toEqual([25, 30]);
    });

    test("unique() should remove duplicates by value (primitives)", () => {
        const collection = new Collection([1, 2, 2, 3]);
        const unique = collection.unique();
        expect(unique.all()).toEqual([1, 2, 3]);
    });

    test("isEmpty() should return true if empty", () => {
        const collection = new Collection([]);
        expect(collection.isEmpty()).toBe(true);
    });

    test("isNotEmpty() should return true if not empty", () => {
        const collection = new Collection(items);
        expect(collection.isNotEmpty()).toBe(true);
    });

    test("length() should return count", () => {
        const collection = new Collection(items);
        expect(collection.length()).toBe(3);
    });

    test("firstOrFail() should return first item", () => {
        const collection = new Collection(items);
        expect(collection.firstOrFail()).toEqual(items[0]);
    });

    test("firstOrFail() should throw on empty collection", () => {
        const collection = new Collection([]);
        expect(() => collection.firstOrFail()).toThrow("Collection is empty, cannot get first item");
    });

    test("lastOrFail() should return last item", () => {
        const collection = new Collection(items);
        expect(collection.lastOrFail()).toEqual(items[2]);
    });

    test("lastOrFail() should throw on empty collection", () => {
        const collection = new Collection([]);
        expect(() => collection.lastOrFail()).toThrow("Collection is empty, cannot get last item");
    });

    test("push() should return new collection with added items", () => {
        const collection = new Collection([1, 2]);
        const pushed = collection.push(3, 4);
        expect(pushed.all()).toEqual([1, 2, 3, 4]);
        expect(collection.count()).toBe(2); // immutable
    });

    test("pop() should return last item and new collection", () => {
        const collection = new Collection([1, 2, 3]);
        const [popped, remaining] = collection.pop();
        expect(popped).toBe(3);
        expect(remaining.all()).toEqual([1, 2]);
        expect(collection.count()).toBe(3); // immutable
    });

    test("sortBy() should sort by key ascending", () => {
        const collection = new Collection(items);
        const sorted = collection.sortBy("age");
        expect(sorted.pluck("name").all()).toEqual(["Alice", "Charlie", "Bob"]);
    });

    test("sortBy() should sort by key descending", () => {
        const collection = new Collection(items);
        const sorted = collection.sortBy("age", "desc");
        expect(sorted.first()?.name).toBe("Bob");
    });

    test("sortBy() should sort with callback", () => {
        const collection = new Collection([3, 1, 2]);
        const sorted = collection.sortBy((a, b) => a - b);
        expect(sorted.all()).toEqual([1, 2, 3]);
    });

    test("chunk() should split into smaller collections", () => {
        const collection = new Collection([1, 2, 3, 4, 5]);
        const chunks = collection.chunk(2);
        expect(chunks.count()).toBe(3);
        expect(chunks.first()?.all()).toEqual([1, 2]);
        expect(chunks.last()?.all()).toEqual([5]);
    });

    test("take() should return first N items", () => {
        const collection = new Collection(items);
        const taken = collection.take(2);
        expect(taken.count()).toBe(2);
        expect(taken.pluck("name").all()).toEqual(["Alice", "Bob"]);
    });

    test("skip() should skip first N items", () => {
        const collection = new Collection(items);
        const skipped = collection.skip(1);
        expect(skipped.count()).toBe(2);
        expect(skipped.first()?.name).toBe("Bob");
    });

    test("toArray() should return plain array", () => {
        const collection = new Collection([1, 2, 3]);
        expect(collection.toArray()).toEqual([1, 2, 3]);
    });

    test("toJSON() should return JSON string", () => {
        const collection = new Collection([{ id: 1 }, { id: 2 }]);
        const json = collection.toJSON();
        expect(json).toBe('[{"id":1},{"id":2}]');
    });

    test("reduce() should accumulate values", () => {
        const collection = new Collection([1, 2, 3, 4]);
        const sum = collection.reduce((acc, item) => acc + item, 0);
        expect(sum).toBe(10);
    });

    test("contains() should find value", () => {
        const collection = new Collection([1, 2, 3]);
        expect(collection.contains(2)).toBe(true);
        expect(collection.contains(5)).toBe(false);
    });

    test("contains() should work with callback", () => {
        const collection = new Collection(items);
        expect(collection.contains((item) => item.name === "Alice")).toBe(true);
        expect(collection.contains((item) => item.name === "Zed")).toBe(false);
    });

    test("each() should iterate items", () => {
        const collection = new Collection([1, 2, 3]);
        const result: number[] = [];
        collection.each((item) => {
            result.push(item);
            return undefined;
        });
        expect(result).toEqual([1, 2, 3]);
    });

    test("each() should stop on false", () => {
        const collection = new Collection([1, 2, 3, 4]);
        const result: number[] = [];
        collection.each((item) => {
            result.push(item);
            if (item === 2) {
                return false;
            }
            return undefined;
        });
        expect(result).toEqual([1, 2]);
    });

    test("avg() should return 0 for empty collection", () => {
        const collection = new Collection<{ val: number }>([]);
        expect(collection.avg("val")).toBe(0);
    });

    test("min() should return 0 for empty collection", () => {
        const collection = new Collection<number>([]);
        expect(collection.min()).toBe(0);
    });

    test("max() should return 0 for empty collection", () => {
        const collection = new Collection<number>([]);
        expect(collection.max()).toBe(0);
    });
});
