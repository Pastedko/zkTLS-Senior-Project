const https=require("node:https");
const fs=require("node:fs");
const path=require("node:path");

const {attest}=require("./notary/notary");
const {generateProof}=require("./prover/prover");
const {verifyProof}=require("./verifier/verifier");

const serverCertificate=fs.readFileSync(path.join(__dirname,"src/server/keys/cert.pem"));

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