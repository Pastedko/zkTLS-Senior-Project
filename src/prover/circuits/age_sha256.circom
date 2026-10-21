pragma circom 2.1.6;
include "sha256_core.circom";

//This is a helper used to get the value of the responseLenght
//We cannot use the raw value of the responseLenght as an array index
//because Circom does not allow it. Instead this template will create an array
//that looks like this [0,0,0,1,0] and we iterate over it in order to find the
//correct length between start and end
template LengthFinder(start,end){
    signal input in;
    signal input out[end-start+1];

    var count=0;
    var value=0;

    for(var i=0;i<=end-start;i++){
        out[i]<--in=start+i?1:0;

        //guarantees 1 or 0
        out[i]*(out[i]-1)===0;

        count+=out[i];
        value+=out[i]*(start+i);
    }

    count===1;
    in===value;
}

template AgeProofSha256(){
    signal input responseBytes[100];
    signal input responseLength;
    signal input randomness[32];
    signal input birthdate;
    signal input idLength;
    signal input identityId;
    signal input commitmentSplit[8];
    signal input cutoffDate;

    component size = LengthFinder(42,100);
    size.in<==responseLength;

    component idSize= LengthFinder(1,9);
    idSize.in<==idLength;

    component responseBits[100];
    component randomBits[32];

    for(var i=0;i<100;i++){
        reseponseBits[i]=Bits(8);
        reseponseBits[i].in<==responseBytes[i];
        var active = 0;
        for(var n=42;n<=100;n++){
            if(i<n){
                active+=size.out[n-42];
            }
        }
        //ensure that the padding is only zeros
        (1-active)*responseBytes[i]===0;
    }

    for(var i=0;i<32;i++){
        randomBits[i]=Bits(8);
        randomBits[i].in<==randomness[i];
    }

    //the ascii codes of '{"id":' which is the beggining of the canonical JSON
    var prefix[6] = [123,34,105,100,34,58];

    for(var i=0;i<6;i++){
        responseBytes[i]===prefix[i];
    }

    //after that we have ',"name":"'
    var name[9]=[44,34,110,97,109,101,34,58,34];

    //if we are on the correct index of the length, e.g. we know the actual length of the id
    //we check if the following bytes are the expected bytes.
    for(var n=1;n<=9;n++){
        for(var j=0;j<9;j++){
            idSize.out[n-1]*(responseBytes[6+n+j]-nameMarker[j])===0;
        }
    }

    //TODO: check if the id is an integer

    //the response finally ends in ',"birthdate":"YYYYMMDD"}'

    var ending[14]=[44,34,98,105,114,116,104,100,97,116,101,34,58,34];

    for(var n=43;n<=100;n++){
        for(var j=0;j<14;j++){
            size.out[n-42]*(responseBytes[n-24+j]-ending[j]===0);
        }

        //trailing '"'
        size.out[n-42]*(responseBytes[n-2]-34)===0;
        //trailing '}'
        size.out[n-42]*(responseBytes[n-1]-125)===0;
    }

}