const fs = require("node:fs");
const path = require("node:path");
const {verify} = require("node:crypto");
const snarkjs=require("snarkjs");

const notaryPublicKey = fs.readFileSync(path.join(__dirname,"../notary/keys/public.pem"));
const verificationKeys={
    sha256: JSON.parse(fs.readFileSync(path.join(__dirname,"../../build/sha256/verification_key.json"),"utf8")),
    poseidon: JSON.parse(fs.readFileSync(path.join(__dirname,"../../build/poseidon/verification_key.json"),"utf8")),
    mimc: JSON.parse(fs.readFileSync(path.join(__dirname,"../../build/mimc/verification_key.json"),"utf8"))
};

async function verifyProof(artifact,policy){
    try{
        const {proof,publicSignals,publicAttestation}=artifact;
        const algorithm=policy.algorithm;

        const verificationKey=verificationKeys[algorithm];
        const expectedSignals=algorithm==="sha256"?10:3;
        if(!Array.isArray(publicSignals)||publicSignals.length!=expectedSignals){
            throw new Error(`Expected ${expectedSignals} public signals`);
        }

        const {commitment,signedAttestation}=publicAttestation;

        if(!Buffer.isBuffer(commitment)||commitment.length!=32){
            throw new Error("Invalid notary signature format");
        }

        const signedMessage=JSON.stringify({
            commitment:commitment.toString("hex"),
            serverAddress:policy.serverAddress
        })

        const signatureValid=verify(
            null,
            Buffer.from(signedMessage),
            notaryPublicKey,
            signedAttestation
        );

        if(!signatureValid){
            throw new Error("Invalid notary signature");
        }

        const indexOfCutoffDate=algorithm==="sha256"?9:2;

        if(publicSignals[indexOfCutoffDate]!=policy.cutoffDate){
            throw new Error("Cutoff date does not match");
        }

        if(publicSignals[0]!=policy.identity.id){
            throw new Error("Ideneity does not match");
        }

        if(algorithm==="sha256"){
        for(let i=0;i<8;i++){
            const signedWord=commitment.readUInt32BE(i*4);
            if(publicSignals[i+1]!=signedWord){
                throw new Error("Commitment does not match attestation")
            }
        }}
        else{
            const signedValue=BigInt('0x'+commitment.toString('hex'));
            if(publicSignals[1]!=signedValue){
                throw new Error("Commitment does not match attestation")
            }
        }

        const proofValid=await snarkjs.groth16.verify(verificationKey,publicSignals,proof);

        if(!proofValid){
            throw new Error("Groth16 proof verification failed");
        }

        return true;
    }catch(error){
        return false;
    }
}

module.exports={verifyProof};