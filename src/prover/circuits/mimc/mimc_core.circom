pragma circom 2.1.6;

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