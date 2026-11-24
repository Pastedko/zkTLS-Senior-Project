const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
    poseidonCommitment
} = require("../../../src/hashing_algorithms/poseidon/poseidon");

const buildCalculator = require(
    "../../../src/prover/circuits/poseidon/age_poseidon_js/witness_calculator"
);

test("age circuit accepts the JavaScript Poseidon commitment and rejects an altered commitment", async () => {
    const response = Buffer.from(JSON.stringify({
        id: 1,
        name: "Test User",
        birthdate: "20040806"
    }));

    const randomness = Buffer.alloc(32, 0xa5);
    const commitment = poseidonCommitment(response, randomness);

    const commitmentValue = BigInt(
        "0x" + commitment.toString("hex")
    );

    const paddedResponse = Buffer.alloc(100);
    response.copy(paddedResponse);

    const inputs = {
        responseBytes: Array.from(paddedResponse),
        responseLength: response.length,
        randomness: Array.from(randomness),
        birthdate: 20040806,
        cutoffDate: 20081023,
        commitmentValue: commitmentValue.toString(),
        identityId: 1,
        idLength: 1
    };

    const wasmPath = path.join(
        __dirname,
        "../../../src/prover/circuits/poseidon/age_poseidon_js/age_poseidon.wasm"
    );

    const calculator = await buildCalculator(
        fs.readFileSync(wasmPath)
    );

    const witness = await calculator.calculateWitness(inputs, true);


    assert.equal(witness[2], commitmentValue);

    const alteredInputs = {
        ...inputs,
        commitmentValue: (commitmentValue + 1n).toString()
    };

    //rejects altered witness
    await assert.rejects(
        () => calculator.calculateWitness(alteredInputs, true),
        /Assert Failed/
    );

    //rejects altered identity id
    await assert.rejects(
        () => calculator.calculateWitness({
            ...inputs,
            identityId: inputs.identityId + 1
        }, true),
        /Assert Failed/
    );

    //rejects altered birthdate
    await assert.rejects(
        () => calculator.calculateWitness({
            ...inputs,
            birthdate: inputs.birthdate + 1
        }, true),
        /Assert Failed/
    );

    //accepts birthdate that is before cutoff date
    await assert.doesNotReject(
        () => calculator.calculateWitness({
            ...inputs,
            cutoffDate: inputs.birthdate
        }, true)
    );

    //rejects birthdate after cutoff date
    await assert.rejects(
        () => calculator.calculateWitness({
            ...inputs,
            cutoffDate: inputs.birthdate - 1
        }, true),
        /Assert Failed/
    );
});