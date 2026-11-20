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
    signal input in[8];
    signal output out[8];

    for(var i=0;i<8;i++){
        var sum=0;

        for(var j=0;j<8;j++){
            sum+=matrix[i][j]*in[j];
        }

        out[i]<==sum;
    }
}

template PoseidonRound(matrix,roundConstants,fullRound){
    signal input in[8];
    signal output out[8];

    var sboxCount=fullRound?8:1;
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

   for(var i=0;i<8;i++){
        out[i]<==mix.out[i];
   }
}

template PoseidonHash(){
    signal input in[7];
    signal output out;

    var constants[576] = PoseidonConstants8();
    var matrix[8][8] = PoseidonMatrix8();

    component rounds[72];

    for(var r=0;r<72;r++){
        var roundConstants[8];

        for(var i=0;i<8;i++){
            roundConstants[i]=constants[r*8+i];
        }

        var fullRound=r<4||r>=68;

        rounds[r]=PoseidonRound(matrix,roundConstants,fullRound);

        for(var i=0;i<8;i++){
            if(r==0){
                //because I have 7 inputs, the first input is 0 and the rest are the inputs
                if(i==0){
                    rounds[r].in[i]<==0;
                }
                else{
                    rounds[r].in[i]<==in[i-1];
                }
            }
            else{
                rounds[r].in[i]<==rounds[r-1].out[i];
            }
        }
    }
    out<==rounds[71].out[0];
    
}