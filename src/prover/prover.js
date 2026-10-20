const sha256 = require('../hashing_algorithms/sha256');
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

function prepareCircuit(notaryResponse, cutoff) {

    const {response, randomness} = notaryResponse.privateProverInput;
    
    const {commitment} = notaryResponse.publicAttestation;

    //check that the response is valid and matches the commitment
    const computedCommitment = sha256(response, randomness);

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

    const responseArray = Buffer.alloc(Max_RESPONSE_LENGTH);
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
        cutoff: cutoffDate,
        commiitmentSplit: commitmentSplit,
        identityId: identity.id,
    }
}

function generateProof(notaryResponse, cutoffDate, wasmPath, zkeyPath){
    const circuitInputs = prepareCircuit(notaryResponse, cutoffDate);
    const {prorf, publicSignals} = snarkjs.groth16.fullProve(circuitInputs, wasmPath, zkeyPath);
    return {
        proof,
        publicSignals,
        publicAttestation: notaryResponse.publicAttestation
    }
}

module.exports = {generateProof, prepareCircuit}