const { before, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
    mimc
} = require("../../../src/hashing_algorithms/mimc/mimc");

const buildCalculator = require(
    "./mimc_hash_test_js/witness_calculator"
);

let calculator;

before(async () => {
    const wasmPath = path.join(
        __dirname,
        "mimc_hash_test_js/mimc_hash_test.wasm"
    );

    calculator = await buildCalculator(fs.readFileSync(wasmPath));
});

test("Circom and JavaScript MiMC agree for distinct inputs", async () => {
    const inputs = [1n, 2n, 3n, 4n, 5n, 6n, 7n];

    const witness = await calculator.calculateWitness(
        { in: inputs },
        true
    );

    assert.equal(witness[1], mimc(inputs));
});

test("Circom and JavaScript MiMC agree for seven zeros", async () => {
    const inputs = Array(7).fill(0n);

    const witness = await calculator.calculateWitness(
        { in: inputs },
        true
    );

    assert.equal(witness[1], mimc(inputs));
});

test("Circom and JavaScript MiMC disaggree for different inputs", async () => {
    const input1 = Array(7).fill(0n);
    const input2= Array(7).fill(2n)

    const witness = await calculator.calculateWitness(
        { in: input1 },
        true
    );

    assert.notEqual(witness[1], mimc(input2));
});

