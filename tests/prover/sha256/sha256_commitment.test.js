const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
    mimcCommitment
} = require("../../../src/hashing_algorithms/MiMC/mimc");

const sha256 = require("../../../src/hashing_algorithms/sha256");

const buildCalculator = require(
    "../../../src/prover/circuits/sha256/age_sha256_js/witness_calculator"
);

test("age circuit accepts the JavaScript SHA-256 commitment and rejects an altered commitment", async () => {
    const response = Buffer.from(JSON.stringify({
        id: 1,
        name: "Test User",
        birthdate: "20040806"
    }));

    const randomness = Buffer.alloc(32, 0xa5);
    const commitment = sha256(response, randomness);

    const commitmentSplit = Array.from(
        { length: 8 },
        (_, index) => commitment.readUInt32BE(index * 4)
    );

    const paddedResponse = Buffer.alloc(100);
    response.copy(paddedResponse);

    const inputs = {
        responseBytes: Array.from(paddedResponse),
        responseLength: response.length,
        randomness: Array.from(randomness),
        birthdate: 20040806,
        cutoffDate: 20081023,
        commitmentSplit,
        identityId: 1,
        idLength: 1
    };

    const wasmPath = path.join(
        __dirname,
        "../../../src/prover/circuits/sha256/age_sha256_js/age_sha256.wasm"
    );

    const calculator = await buildCalculator(
        fs.readFileSync(wasmPath)
    );

    const witness = await calculator.calculateWitness(inputs, true);


    for (let index = 0; index < 8; index++) {
        assert.equal(
            witness[index + 2],
            BigInt(commitmentSplit[index])
        );
    }

    const alteredCommitment = [...commitmentSplit];
    alteredCommitment[0] = (alteredCommitment[0] + 1) >>> 0;

    const alteredInputs = {
        ...inputs,
        commitmentSplit: alteredCommitment
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
})