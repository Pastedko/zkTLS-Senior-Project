const sha256 = require('../hashing_algorithms/sha256');
const {poseidonCommitment} = require('../hashing_algorithms/poseidon/poseidon');
const {isValidBirthdate} = require('../notary/notary');
const { Buffer } = require("node:buffer");
const snarkjs = require("snarkjs");

const MAX_RESPONSE_LENGTH = 100;

function dateToNumber(date){
    const isValid = isValidBirthdate(date);
    if (!isValid) {
        throw new Error("Invalid date");
    }
    return parseInt(date);
}

function prepareCircuit(notaryResponse, cutoff,algorithm) {

    const {response, randomness} = notaryResponse.privateProverInput;
    
    const {commitment} = notaryResponse.publicAttestation;

    //check that the response is valid and matches the commitment
    let computedCommitment;

    switch(algorithm){
        case "sha256":
            computedCommitment = sha256(response, randomness);
            break;
        case "poseidon":
            computedCommitment = poseidonCommitment(response, randomness);
            break;
        default:
            throw new Error("Unsupported algorithm");
    }

    if(!commitment.equals(computedCommitment)) {
        throw new Error("Commitment does not match the response and randomness");
    }

    const decoder= new TextDecoder("utf-8", { fatal: true });

    const identity = JSON.parse(decoder.decode(response));

    if(identity === null || typeof identity !== "object" || Array.isArray(identity)) {
        throw new Error("Response is not a valid JSON object");
    }

    const birthdate = dateToNumber(identity.birthdate);
    const cutoffDate = dateToNumber(cutoff);

    const responseArray = Buffer.alloc(MAX_RESPONSE_LENGTH);
    response.copy(responseArray);


    //we need to split the commitment into 8 32-bit integers for the circuit
    //Circom does not support 256 integers
    const commitmentSplit =[]
    for (let i = 0; i < 8; i++) {
        commitmentSplit[i] = commitment.readUInt32BE(i * 4);
    }

    return {
        responseBytes: Array.from(responseArray),
        responseLength: response.length,
        randomness: Array.from(randomness),
        birthdate: birthdate,
        cutoffDate: cutoffDate,
        commitmentSplit: commitmentSplit,
        identityId: identity.id,
        idLength:String(identity.id).length
    }
}

async function generateProof(notaryResponse, cutoffDate, wasmPath, zkeyPath,algorithm){
    const circuitInputs = prepareCircuit(notaryResponse, cutoffDate,algorithm);
    const {proof, publicSignals} = await snarkjs.groth16.fullProve(circuitInputs, wasmPath, zkeyPath);
    return {
        proof,
        publicSignals,
        publicAttestation: notaryResponse.publicAttestation
    }
}

module.exports = {generateProof, prepareCircuit}