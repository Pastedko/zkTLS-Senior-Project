const fieldPrime=21888242871839275222246405745257275088548364400416034343698204186575808495617n;

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

console.log(mixState([1n,2n],[[1n,2n],[3n,4n]]));