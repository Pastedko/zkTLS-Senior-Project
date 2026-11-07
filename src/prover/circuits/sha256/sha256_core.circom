pragma circom 2.1.6;

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

// modulo 2^32 addition of n inputs, where n is between 2 and 5
template AddWord(n){
    assert(n>=2 && n<=5);

    signal input in[n];
    signal output out;

    var sum = 0;

    for(var i=0; i<n;i++){
        sum += in[i];
    }

    //component keyword is used to instantiate a template
    component bits = Bits(35);
    bits.in <== sum;

    var low = 0;

    for (var i=0; i<32;i++){
        low += bits.out[i] * (1 << i);
    }

    out<== low; // guarantees that out is equal to the sum of the inputs modulo 2^32
}

// sha256 uses a set of bitwise operations called sigma functions, which are defined as follows:
// 3 right rotations
// 2 right rotations and 1 right shift
template Sigma(r1,r2,r3,shift){
    signal input in;
    signal output out;

    signal xy[32];
    signal result[32];

    component bits = Bits(32);
    bits.in <== in;

    var value = 0;

    for (var i=0;i<32;i++){
        var x = bits.out[(i+r1)%32];
        var y = bits.out[(i+r2)%32];
        var z=0;

        if(shift == 0){
            z = bits.out[(i+r3)%32];
        }
        else if(i+r3<32){
            z=bits.out[i+r3];
        }

        //XOR operator
        //x XOR y
        xy[i]<==x+y-2*x*y;
        //(x XOR y) XOR z
        result[i]<==xy[i]+z-2*xy[i]*z;

        value+=result[i]*(1<<i);
    }

    out<==value;
}

//implement the choice algorithm used in sha256
//const choice = (e & f) ^ (~e & g); inside compressBlock()
template Choice(){
    signal input in[3];
    signal output out;

    component bits[3];

    for(var i=0;i<3;i++){
        bits[i] = Bits(32);
        bits[i].in<==in[i];
    }

    signal result[32];
    var value = 0;

    for(var i=0;i<32;i++){
        result[i]<==bits[2].out[i]+bits[0].out[i]*(bits[1].out[i]-bits[2].out[i]);

        value+=result[i]*(1<<i);
    }

    out<==value;
}

//implement the majority algorithm from sha256
//const majority = (a & b) ^ (a & c) ^ (b & c); inside compressBlock()
template Majority(){
    signal input in[3];
    signal output out;

    component bits[3];

    for (var i=0;i<3;i++){
        bits[i]=Bits(32);
        bits[i].in<==in[i];
    }

    signal ab[32];
    signal result[32];

    var value=0;

    for(var i=0; i<32; i++){
        ab[i]<==bits[0].out[i]*bits[1].out[i];

        result[i]<==ab[i]+bits[2].out[i]*(bits[0].out[i]+bits[1].out[i]-2*ab[i]);

        value+=result[i]*(1<<i);
    }

    out <==value;
}

template SHA256Compress(){
    signal input hash[8];
    signal input block[16];
    signal output out[8];

    var K[64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    signal words[64];

    for(var i=0; i<16;i++){
        words[i]<==block[i];
    }

    component sigma0[48];
    component sigma1[48];
    component expand[48];

    for(var i=16;i<64;i++){
        sigma0[i-16]=Sigma(7,18,3,1);
        sigma1[i-16]=Sigma(17,19,10,1);

        sigma0[i-16].in<==words[i-15];
        sigma1[i-16].in<==words[i-2];

        expand[i-16] = AddWord(4);
        expand[i-16].in[0]<==words[i-16];
        expand[i-16].in[1]<==sigma0[i-16].out;
        expand[i-16].in[2]<==words[i-7];
        expand[i-16].in[3]<==sigma1[i-16].out;

        words[i]<==expand[i-16].out;
    }

    //contains a,b,c,d,e,f,g,h
    signal state[65][8];

    for(var i=0;i<8;i++){
        state[0][i]<==hash[i];
    }

    component sum0[64];
    component sum1[64];
    component choice[64];
    component majority[64];
    component temp1[64];
    component temp2[64];
    component nextA[64];
    component nextE[64];

    for(var t=0;t<64;t++){
        sum0[t]=Sigma(2,13,22,0);
        sum1[t]=Sigma(6,11,25,0);

        sum0[t].in<==state[t][0];
        sum1[t].in<==state[t][4];

        choice[t]=Choice();
        majority[t]=Majority();

        for(var i=0;i<3;i++){
            choice[t].in[i]<==state[t][4+i];
            majority[t].in[i]<==state[t][i];
        }

        temp1[t]=AddWord(5);
        temp1[t].in[0]<==state[t][7];
        temp1[t].in[1]<==sum1[t].out;
        temp1[t].in[2]<==choice[t].out;
        temp1[t].in[3]<==K[t];
        temp1[t].in[4]<==words[t];

        temp2[t]=AddWord(2);
        temp2[t].in[0]<==sum0[t].out;
        temp2[t].in[1]<==majority[t].out;

        nextA[t]=AddWord(2);
        nextA[t].in[0]<==temp1[t].out;
        nextA[t].in[1]<==temp2[t].out;

        nextE[t]=AddWord(2);
        nextE[t].in[0]<==state[t][3];
        nextE[t].in[1]<==temp1[t].out;

        state[t+1][0]<==nextA[t].out; //new a
        state[t+1][1]<==state[t][0]; //new b
        state[t+1][2]<==state[t][1]; //new c
        state[t+1][3]<==state[t][2]; //new d
        state[t+1][4]<==nextE[t].out; //new e
        state[t+1][5]<==state[t][4]; //new f
        state[t+1][6]<==state[t][5]; //new g
        state[t+1][7]<==state[t][6]; //new h
    }

    component feedForward[8];

    for(var i=0;i<8;i++){
        feedForward[i]=AddWord(2);
        feedForward[i].in[0]<==hash[i];
        feedForward[i].in[1]<==state[64][i];

        out[i]<==feedForward[i].out;
    }

}