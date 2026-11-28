const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sign } = require("node:crypto");

const { generateProof } = require("../../src/prover/prover");
const { verifyProof } = require("../../src/verifier/verifier");

const {
    poseidonCommitment
} = require("../../src/hashing_algorithms/poseidon/poseidon");

const policy = {
    algorithm: "poseidon",
    serverAddress: "https://localhost:3000/identity",
    cutoffDate: "20081023",
    identity: { id: 1 }
};

let artifact;

before(async () => {
    const response = Buffer.from(JSON.stringify({
        id: 1,
        name: "Test User",
        birthdate: "20040806"
    }));

    const randomness = Buffer.alloc(32, 0xa5);
    const commitment = poseidonCommitment(response, randomness);

    const privateKey = fs.readFileSync(
        path.join(__dirname, "../../src/notary/keys/private.pem")
    );

    const signedAttestation = sign(
        null,
        Buffer.from(JSON.stringify({
            commitment: commitment.toString("hex"),
            serverAddress: policy.serverAddress
        })),
        privateKey
    );

    //creating the notary response artificially so that the server does not have to be run
    const notaryResponse = {
        privateProverInput: {
            response,
            randomness
        },
        publicAttestation: {
            commitment,
            signedAttestation
        }
    };

    artifact = await generateProof(
        notaryResponse,
        policy.cutoffDate,
        path.join(
            __dirname,
            "../../src/prover/circuits/poseidon/age_poseidon_js/age_poseidon.wasm"
        ),
        path.join(
            __dirname,
            "../../build/poseidon/age_poseidon_final.zkey"
        ),
        policy.algorithm
    );
});

after(async () => {
    if (globalThis.curve_bn128) {
        await globalThis.curve_bn128.terminate();
    }
});

test("verifier accepts a valid signed artifact", async () => {
    assert.equal((await verifyProof(artifact, policy)).valid, true);
});

test("verifier rejects an altered notary signature", async () => {
    const signature = Buffer.from(
        artifact.publicAttestation.signedAttestation
    );

    signature[0] ^= 1;

    const alteredArtifact = {
        ...artifact,
        publicAttestation: {
            ...artifact.publicAttestation,
            signedAttestation: signature
        }
    };

    assert.equal((await verifyProof(alteredArtifact, policy)).valid, false);
});

test("verifier rejects a different expected identity", async () => {
    const alteredPolicy = {
        ...policy,
        identity: { id: 2 }
    };

    assert.equal((await verifyProof(artifact, alteredPolicy)).valid, false);
});

test("verifier rejects a different required cutoff", async () => {
    const alteredPolicy = {
        ...policy,
        cutoffDate: "20081024"
    };

    assert.equal((await verifyProof(artifact, alteredPolicy)).valid, false);
});

test("verifier rejects a different expected server", async () => {
    const alteredPolicy = {
        ...policy,
        serverAddress: "https://invalid.server/identity"
    };

    assert.equal((await verifyProof(artifact, alteredPolicy)).valid, false);
});

test("verifier rejects a public commitment that differs from the attestation", async () => {
    const publicSignals = [...artifact.publicSignals];

    publicSignals[1] = (
        BigInt(publicSignals[1]) + 1n
    ).toString();

    const alteredArtifact = {
        ...artifact,
        publicSignals
    };

    assert.equal((await verifyProof(alteredArtifact, policy)).valid, false);
});

test("verifier rejects a changed cutoff even when the policy matches it", async () => {
    const publicSignals = [...artifact.publicSignals];
    //change the cutoff date
    publicSignals[2] = "20081024";

    const alteredArtifact = {
        ...artifact,
        publicSignals
    };

    const alteredPolicy = {
        ...policy,
        cutoffDate: "20081024"
    };

    assert.equal(
        (await verifyProof(alteredArtifact, alteredPolicy)).valid,
        false
    );
});