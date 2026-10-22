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

//Ascii to digit converter
template AsciiToDigit(){
    signal input ascii;
    signal output value;

    component digit = LengthFinder(48,57);
    digit.in<==ascii;

    value<==ascii-48;
}

template ResponseCommitment(){
    signal input responseBytes[100];
    signal input responseLength;
    signal input randomness[32];

    signal output out[8];

    component size = LengthFinder(42,100);
    size.in<==responseLength;

    signal responsePart[192][59];
    signal randomnessPart[192][59];
    signal paddedBytes[192];

    for(var p=0;p<192;p++){
        var byteValue = 0;

        for(var n=42;n<=100;n++){
            if(p<n){
                responsePart[p][n-42]<==size.out[n-42]*responseBytes[p];            }
        }
        else{
            responsePart[p][n-42]<==0;
        }

        if(p>=n&&p<n+32){
            randomnessPart[p][n-42]<==size.out[n-42]*randomness[p-n];
        }
        else{
            randomnessPart[p][n-42]<==0;
        }
        byteValue+=responsePart[p][n-42];
        byteValue+=randomnessPart[p][n-42];

        var messageLength=n+32;
        var paddedLength=128;

        if(messageLength>=120){
            paddedLength=192;
        }

        if(p==messageLength){
            byteValue+=size.out[n-42]*128; //append 0x80, 128 (decimal)
        }


        //the last 8 bytes contain the length of the message
        //since the message length can at most fit into 2 bytes
        //we update only the last 2 bytes
        if(p==paddedLength-2){
            byteValue+=size.out[n-42]*((messageLength*8)\256);//integer division
        }

        if(p==paddedLength-1){
            byteValue+=size.out[n-42]*((messageLength*8)%256);
        }
    }

    paddedBytes[p]<==byteValue;

    //initial values of the words
    var initialHash[8]=[
        0x6a09e667,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19
    ]

    component compress[3];

    for(var b=0;b<3;b++){
        compress[b]=SHA256Compress();

        for(var w=0;w<16;w++){
            var offset=b*64+w*4;
            compress[b].block[w]<==paddedBytes[offset]*16777216+paddedBytes[offset+1]*65536+paddedBytes[offset+2]*256+paddedBytes[offset+3]; //left shifts
        }

        for(var w=0;w<8;w++){
            if(b==0){
                compress[b].hash[w]<==initialHash[w];
            }
            else{
                compress[b].hash[w]<==compress[b-1].out[w];
            }
        }
    }
    var needsThirdBlock=0;

    for(var n=88;n<=100;n++){
        needsThirdBlock+=size.out[n-42];
    }

    for(var w=0;w<8;w++){
        out[w]<==compress[1].out[w]+needsThirdBlock*(compress[2].out[w]-compress[1].out[w]);
    }
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

    signal idPick[9][9];
    signal idAscii[9];
    signal idTerm[9][9];

    component idDigit[9];

    for(var j=0; j<9;j++){
        var selectedAscii=0;
        var activeDigit=0;

        for(var n=1;n<=9;n++){
            if(j<n){
                idPick[j][n-1]<==idSize.out[n-1]*responseBytes[6+j];

                activeDigit +=idSize.out[n-1];
            }
            else{
                idPick[j][n-1]<==0;
            }

            selectedAscii+=idPick[j][n-1];
        }

        idAscii[j]<==selectedAscii+48*(1-activeDigit);
        idDigit[j]=AsciiToDigit();
        idDigit.ascii<==idAscii[j];
    }

    var reconstructedId=0;

    for(var n=1;n<=9;n++){
        for(var j=0;j<9;j++){
            if(j<n){
                idTerm[n-1][j]<==idSize.out[n-1]*idDigit[j].value*(10**(n-1-j));
            }
            else{
                idTerm[n-1][j]<==0;
            }

            reconstructedId+=idTerm[n-1][j];

            identityId===reconstructedId;
        }
    }

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

    //extract the eight birthday digits
    signal datePick[8][59];
    component dateDigit[8];

    var dateValue =0 ;

    for(var j=0;j<8;j++){
        var ascii =0;

        for(var n=42;n<=100;n++){
            datePick[j][n-42]<==size.out[n-42]*responseBytes[n-10+j];

            ascii+=datePick[j][n-42];
        }

        dateDigit[j]=AsciiToDigit();
        dateDigit[j].ascii<==ascii;
        dateValue+=dateDigit[j].value*(10**(7-j));
    }

    //enforce that birthdate matches the response birthdate
    birthdate === dateValue;

    //enforce birthdate<=cutoffDate
    
    component cutoffBits=Bits(27);
    cutoffBits.in<==cutoffDate;

    component ageDifference = Bits(27);
    //if birthdate>cutoffDate the checks inside Bits will not pass
    ageDifference.in<==cutoffDate-birthdate;

    component commitment = ResponseCommitment();

    commitment.responseLength<==responseLength;

    for(var i=0;i<100;i++){
        commitment.responseBytes[i]<==responseBytes[i];
    }

    for(var i=0;i<32;i++){
        commitment.randomness[i]<==randomness[i];
    }

    //verify that the resulting hash equals the provided hash
    for(var i=0;i<8;i++){
        commitment.out[i]===commitmentSplit[i];
    }
}

component main = {
    public[identityId,commitmentSplit,cutoffDate]
} = AgeProofSha256();