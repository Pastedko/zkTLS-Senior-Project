const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");

const sha256 = require(
    "../../src/notary/hashing_algorithms/sha256"
);

describe("SHA-256 Hashing Algorithm", () => {
    test("matches Node's SHA-256 implementation", () => {
        const input = Buffer.from("Hello, world!", "utf8");
        const randomness = Buffer.from("randomness", "utf8");

        const message = Buffer.concat([input, randomness]);
        const expectedHash = createHash("sha256").update(message).digest();

        const actualHash = sha256(input, randomness);

        assert.deepEqual(actualHash, expectedHash);
    });
});