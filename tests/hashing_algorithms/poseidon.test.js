const { before, test } = require("node:test");
const assert = require("node:assert/strict");
const { buildPoseidonReference } = require("circomlibjs");

const {
    poseidon
} = require("../../src/hashing_algorithms/poseidon/poseidon");

let poseidonLib;

before(async () => {
    poseidonLib = await buildPoseidonReference();
});

test("Poseidon matches the library for distinct non empty", () => {
    const inputs = [1n, 2n, 3n, 4n, 5n, 6n, 7n];

    const expected = poseidonLib.F.toObject(poseidonLib(inputs));
    const actual = poseidon(inputs);

    assert.equal(actual, expected);
});

test("Poseidon matches the libary for seven zero inputs", () => {
    const inputs = Array(7).fill(0n);

    const expected = poseidonLib.F.toObject(poseidonLib(inputs));
    const actual = poseidon(inputs);

    assert.equal(actual, expected);
});

