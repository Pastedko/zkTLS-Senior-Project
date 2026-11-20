const https=require("node:https");
const fs=require("node:fs");
const path=require("node:path");

const {attest}=require("./notary/notary");
const {generateProof}=require("./prover/prover");
const {verifyProof}=require("./verifier/verifier");

const serverCertificate=fs.readFileSync(path.join(__dirname,"server/keys/cert.pem"));

function login(id,password){
    return new Promise((resolve,reject)=>{
    const body=JSON.stringify({id,password});
    const request=https.request("https://localhost:3000/login",{
        method:"POST",
        ca:serverCertificate,
        headers:{
            "Content-Type": "application/json"
        },
    },(response)=>{
        response.resume();

        if(response.statusCode!=200){
            reject(new Error("Login failed"));
            return;
        }

        const sessionCookie=response.headers["set-cookie"]?.find(cookie=>cookie.startsWith("sessionToken="));
        if(!sessionCookie){
            reject(new Error("Server did not return a session cookie"));
            return;
        }

        resolve(sessionCookie.split(";")[0]);
    });
    request.on("error",reject);
    request.end(body);
    })
}

async function main(){
    const id=1;
    const password="securepass456";

    const policy={
        serverAddress:"https://localhost:3000/identity",
        identity:{id},
        cutoffDate:"20081023",
        algorithm:"poseidon"
    };

    try{
    const cookie=await login(id,password);

    const notaryResponse = await attest(policy.serverAddress,cookie,policy.algorithm);

    const artifact = await generateProof(notaryResponse,policy.cutoffDate,path.join(__dirname,"prover/circuits/poseidon/age_poseidon_js/age_poseidon.wasm"),path.join(__dirname,"../build/poseidon/age_poseidon_final.zkey"),policy.algorithm);

    const valid=await verifyProof(artifact,policy);

    if(valid){
    console.log("Proof is valid")
    }
    else{
        console.log("Proof is invalid");
    }
}
catch(err){
    console.log(err);
    console.log("Proof generation failed: invalid proof or inputs");
}
}

main();