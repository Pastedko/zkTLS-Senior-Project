const { before, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
    poseidon
} = require("../../../src/hashing_algorithms/poseidon/poseidon");

const buildCalculator = require(
    "./poseidon_hash_test_js/witness_calculator"
);

let calculator;

before(async () => {
    const wasmPath = path.join(
    __dirname,
    "poseidon_hash_test_js/poseidon_hash_test.wasm"
);

    calculator = await buildCalculator(fs.readFileSync(wasmPath));
});

test("Circom and JavaScript Poseidon agree for seven zeros", async () => {
    const inputs = Array(7).fill(0n);

    const witness = await calculator.calculateWitness(
        { in: inputs },
        true
    );

    assert.equal(witness[1], poseidon(inputs));
});

test("Circom and JavaScript Poseidon agree for distinct inputs", async () => {
    const inputs = [1n, 2n, 3n, 4n, 5n, 6n, 7n];

    const witness = await calculator.calculateWitness(
        { in: inputs },
        true
    );

    assert.equal(witness[1], poseidon(inputs));
});

test("Circom and JavaScript Poseidon disaggree for different inputs", async () => {
    const input1 = Array(7).fill(0n);
    const input2= Array(7).fill(2n)

    const witness = await calculator.calculateWitness(
        { in: input1 },
        true
    );

    assert.notEqual(witness[1], poseidon(input2));
});
