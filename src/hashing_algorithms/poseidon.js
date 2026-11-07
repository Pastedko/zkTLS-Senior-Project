const {C,M}=require("./poseidon_constants.json");

const fieldPrime=21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const STATE_WIDTH=8;
const FULL_ROUNDS=8;
const PARTIAL_ROUNDS=64;

const parameterIndex= STATE_WIDTH-2;
const roundConstants=C[parameterIndex].map(value=> BigInt(value));
const mixingMatrix=M[parameterIndex].map(row=>row.map(value=>BigInt(value)));

//Circom automatically wraps values around this number
//JS doesn't, so we need to do it manually using this funciton
function mod(value){
    const remainder = value % fieldPrime;

    if(remainder < 0n){
        return remainder + fieldPrime;
    }

    return remainder;
}

function sbox(value){
    const x=mod(value); //x
    const xSquared=mod(x*x); //x^2
    const xFourth=mod(xSquared*xSquared); //x^4

    return mod(xFourth*x); //x^5
}

function mixState(state, matrix){
    return matrix.map((row) => {
        let sum=0n;
        for(let i=0; i<state.length; i++){
            sum+=row[i] * state[i];
        }
        return mod(sum);
    });
}

function poseidonRound(state,roundConstants,matrix,fullRound){
    //1.add constants
    const withConstants=state.map((value,index)=>mod(value+roundConstants[index]));

    //2.apply sbox
    const transformed=withConstants.map((value,index)=>fullRound||index==0?sbox(value):value);

    //3.mix the transformed values
    return mixState(transformed,matrix);
}

function poseidon(input){
    if(input.length!==STATE_WIDTH-1){
        throw new Error(`Input length must be ${STATE_WIDTH-1}`);
    }

    let state=[0n, ...input.map(value=>mod(value))];

    const firstPartialRound=FULL_ROUNDS/2;
    const firstFinalFullRound=firstPartialRound+PARTIAL_ROUNDS;
    const totalRounds=FULL_ROUNDS+PARTIAL_ROUNDS;

    for(let round=0; round<totalRounds; round++){
        const start=round*STATE_WIDTH;
        const constants=roundConstants.slice(start,start+STATE_WIDTH);

        const isFullRound=round<firstPartialRound||round>=firstFinalFullRound;

        state=poseidonRound(state,constants,mixingMatrix,isFullRound);
    }

    return state[0];
}