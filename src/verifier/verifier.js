const fs = require("node:fs");
const path = require("node:path");
const {verify} = require("node:crypto");
const snarkjs=require("snarkjs");

const notaryPublicKey = fs.readFileSync(path.join(__dirname,"../notary/keys/public.pem"));
const verificationKey=JSON.parse(fs.readFileSync(path.join(__dirname,"../../build/sha256/verification_key.json"),"utf8"));

async function verifyProof(artifact,policy){
    try{
        const {proof,publicSignals,publicAttestation}=artifact;
        if(!Array.isArray(publicSignals)||publicSignals.length!=10){
            throw new Error("Expected 10 public signals");
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

        if(publicSignals[0]!=policy.identity.id){
            throw new Error("Ideneity does not match");
        }

        if(publicSignals[9]!=policy.cutoffDate){
            throw new Error("Cutoff date does not match");
        }

        for(let i=0;i<8;i++){
            const signedWord=commitment.readUInt32BE(i*4);
            if(publicSignals[i+1]!=signedWord){
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