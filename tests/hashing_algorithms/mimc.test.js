const { before, test } = require("node:test");
const assert = require("node:assert/strict");
const { buildMimc7 } = require("circomlibjs");

const {
    mimc
} = require("../../src/hashing_algorithms/mimc/mimc");

let mimcLib;

before(async () => {
    mimcLib = await buildMimc7();
});

test("MiMC matches the library for non empty inputs", () => {
    const inputs = [1n, 2n, 3n, 4n, 5n, 6n, 7n];

    assert.equal(
        mimc(inputs),
        mimcLib.F.toObject(mimcLib.multiHash(inputs))
    );
});

test("MiMC matches the library for an empty input", () => {
    const inputs = Array(7).fill(0n);

    assert.equal(
        mimc(inputs),
        mimcLib.F.toObject(mimcLib.multiHash(inputs))
    );
});

