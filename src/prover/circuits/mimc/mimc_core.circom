pragma circom 2.1.6;
include "mimc_parameters.circom";

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

template mimcPow7(){
    signal input in;
    signal output out;

    signal squared;
    signal fourth;
    signal sixth;

    squared<==in*in;
    fourth<==squared*squared;
    sixth<==fourth*squared;
    out<==in*sixth;
}

template mimc7(){
    signal input in;
    signal input key;
    signal output out;

    var constants[91]=MiMCConstants();

    signal state[92];
    component powers[91];

    state[0]<==in;

    for(var round=0;round<91;round++){
        powers[round]=mimcPow7();
        powers[round].in<==state[round]+key+constants[round];
        state[round+1]<==powers[round].out;
    }
    out<==state[91]+key;
}

template MimcHash(){
    signal input in[7];
    signal output out;

    signal accumulator[7];
    component hashes[7];

    accumulator[0]<==0;

    for(var i=0;i<7;i++){
        hashes[i]=mimc7();
        hashes[i].in<==in[i];
        hashes[i].key<==accumulator[i];
        accumulator[i+1]<==hashes[i].out+accumulator[i]+in[i];
    }
    out<==accumulator[7];
}