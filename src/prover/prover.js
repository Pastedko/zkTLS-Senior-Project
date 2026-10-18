const sha256 = require('../hashing_algorithms/sha256');
const {isValidBirthdate} = require('../notary/notary');
const { Buffer } = require("node:buffer");

const MAX_RESPONSE_LENGTH = 100;

function dateToNumber(date){
    const isValid = isValidBirthdate(date);
    if (!isValid) {
        throw new Error("Invalid date");
    }
    return parseInt(date);
}

function prepareCircuit(notaryResponse, cutoffDate) {

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
    const cutoffDate = dateToNumber(cutoffDate);


}