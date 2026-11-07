pragma circom 2.1.6;
include "poseidon_parameters.circom";


//a template is a reusable circuit that can be instantiated multiple times with different parameters
//similar to a class in object-oriented programming
//the Bits tamplate ensures that the input signal in is represented as an array of bits in the output signal out
template Bits(n){
    signal input in;
    signal output out[n];

    var value = 0;

    for(var i=0; i<n;i++){
        out[i] <-- (in>>i)&1; // out is a representation of in with the LSB at out[0] and the MSB at out[n-1]

        out[i] * (1-out[i]) === 0; // guarantees that out[i] is either 0 or 1

        value += out[i] * (1 << i); // reconstructs the value of in from the bits in out
    }

    in === value; // guarantees that the value of in is equal to the value reconstructed from the bits in out
}


template PoseidonSbox() {
    signal input in;
    signal output out;

    signal squared;
    signal fourth;

    squared <== in * in;
    fourth <== squared * squared;
    out <== fourth * in;
}

template PoseidonMix(matrix){
    signal input in[matrix.length];
    signal output out[matrix.length];

    for(var i=0;i<matrix.length;i++){
        var sum=0;

        for(var j=0;j<matrix.length;j++){
            sum+=matrix[i][j]*in[j];
        }

        out[i]<==sum;
    }
}

template PoseidonRound(matrix,roundConstants,fullRound){
    signal input in[matrix.length];
    signal output out[matrix.length];

    var sboxCount=fullRound?matrix.length:1;
    component sboxes[sboxCount];
    component mix = PoseidonMix(matrix);

   for(var i=0;i<8;i++){
    var withConstant=in[i]+roundConstants[i];

    if(i<sboxCount){
        sboxes[i]=PoseidonSbox();
        sboxes[i].in<==withConstant;
        mix.in[i]<==sboxes[i].out;
    }
    else{
        mix.in[i]<==withConstant;
    }
   }

   for(var i=0;i<matrix.length;i++){
        out[i]<==mix.out[i];
   }
}