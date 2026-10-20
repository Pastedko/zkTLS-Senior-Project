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
        xy[i]<==x+y-2*x*y;
        result[i]<==xy[i]+z-2*xy[i]*z;

        value+=result[i]*(1<<i);
    }

    out<==value;
}