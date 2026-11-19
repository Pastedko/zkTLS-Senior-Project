const {mod} = require("../poseidon/poseidon");
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