// Parameter source: iden3/circomlibjs, version 0.1.7.
// https://github.com/iden3/circomlibjs
// Upstream package licence: GPL-3.0.
// Parameters are not original contributions of this project.

const {mod,packCommitedInputs} = require("../poseidon/poseidon");
const roundConstants = require("./mimc_constants.json").map(value => BigInt(value));
const ROUNDS=91;
const FIELD_PRIME =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function pow7(value){
    let result = mod(value);
    for (let i = 0; i < 6; i++) {
        result = mod(result * value);
    } 
    return result;
}

function mimc7(input, key) {
    let state = mod(input);
    const k=mod(key);

    for(let round=0; round<ROUNDS; round++){
        state = mod(state + k + roundConstants[round]);
        state = pow7(state);
    }
    return mod(k+state);
}

function mimc(inputs){
    if(inputs.length!=7){
        throw new Error("Input must be an array of 7 elements");
    }
    let accumulator = BigInt(0);
    for(let i=0; i<7; i++){
        accumulator = mod(mimc7(inputs[i], accumulator)+accumulator+inputs[i]);
    }
    return accumulator;
}

function mimcCommitment(response,randomness){
    const inputs=packCommitedInputs(response,randomness);
    const digest=mimc(inputs);

    const hex=digest.toString(16).padStart(64,"0");
    return Buffer.from(hex,"hex");
}

module.exports={mimc, mimcCommitment};