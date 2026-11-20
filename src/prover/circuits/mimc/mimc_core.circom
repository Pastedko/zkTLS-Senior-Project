pragma circom 2.1.6;
include "mimc_parameters.circom";

template mimcPow7(){
    signal input in;
    signal output out;

    signal suqared;
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
    out<==state[92]+key;
}

template mimc(){
    signal input in[7];
    signal output out;

    signal accumulator;
    component hashes[7];

    accumulator<==0;

    for(var i=0;i<7;i++){
        hashes[i]=mimc7();
        hashes[i].in<==in[i];
        hashes[i].key<==accumulator;
        accumulator<==hashes[i].out+accumulator+in[i];
    }
    out<==accumulator;
}