const https = require("https");
const fs = require("fs");
const path = require("path");
const sha256 = require("./hashing_algorithms/sha256");
const { randomBytes } = require("node:crypto");

//After testing with differnt id and name lengths it is safe to set the max response length to 100 bytes
//as anything above that value would be unreasonable.
const MAX_RESPONSE_LENGTH = 100;

const serverCertificate = fs.readFileSync(
    path.join(__dirname, "../server/cert.pem")
);

async function attest(address, cookie) {
    const responseBytes = await makeRequest(address, cookie);
    const canonicalIdentity = validateCanonicalResponse(responseBytes);
    const commitment = createCommitment(responseBytes, randomBytes(32));
}

function createCommitment(responseBytes, randomness){
    return sha256(responseBytes,randomness)
} 

function validateCanonicalResponse(responseBytes) {
    if(responseBytes.length < 1 || responseBytes.length > MAX_RESPONSE_LENGTH) {
        throw new Error("Invalid response length");
    }

    let identity;

    try {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        identity = JSON.parse(decoder.decode(responseBytes));
    }
    catch {
        throw new Error("Response is not valid UTF-8 or JSON");
    }

    if(identity===null|| typeof identity!== "object" || Array.isArray(identity)) {
        throw new Error("Response is not a valid JSON object");
    }

    //validate required fields
    if(identity.id === undefined || identity.name === undefined || identity.birthdate === undefined) {
        throw new Error("Response is missing required fields");
    }

    
    //validate data types
    if(typeof identity.id !== "number" || typeof identity.name !== "string" || typeof identity.birthdate !== "string") {
        throw new Error("Response fields have incorrect types");
    }

    //validate id range
    if(identity.id < 0 || identity.id > 999999999 || !Number.isSafeInteger(identity.id)) {
        throw new Error("ID is out of valid range");
    }

    //validate name length
    if(identity.name.length < 1 || identity.name.length > 50) {
        throw new Error("Name length is out of valid range");
    }

    //validate birthdate
    if(!isValidBirthdate(identity.birthdate)) {
        throw new Error("Birthdate is not in valid format");
    }

    //validate format
    const canonicalIdentity = {
        id: identity.id,
        name: identity.name,
        birthdate: identity.birthdate
    };

    const canonicalBytes = Buffer.from(
        JSON.stringify(canonicalIdentity),
        "utf8"
    );

    if(!canonicalBytes.equals(responseBytes)) {
        throw new Error("Response is not in canonical format");
    }

    return canonicalIdentity;
}

function isValidBirthdate(birthdate) {

    //verify birthdate format is YYYYMMDD and is a valid date
    if(typeof birthdate !== "string"||!/^\d{8}$/.test(birthdate)) {
    return false;
    }

    //extract year, month, and day from birthdate string
    const year = Number(birthdate.slice(0, 4));
    const month = Number(birthdate.slice(4, 6));
    const day = Number(birthdate.slice(6, 8));

    //verify that the year, month, and day are within valid ranges
    if(year<1900 || year>2026) {
        return false;
    }

    if(month<1 || month>12) {
        return false;
    }

    if(day<1 || day>31) {
        return false;
    }

    //verify that the day is valid for the given month and year
    const leapYear  = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if(day > daysInMonth[month - 1]) {
        return false;
    }

    return true;
}

async function makeRequest(address, cookie){
    return new Promise((resolve,reject)=>{
    const request = https.get(address, {
        headers: {
            "Cookie": cookie
        },
        ca: serverCertificate
    }, (res) => {
        const chunkdata = [];
        res.on("data", (chunk) => {
            chunkdata.push(chunk);
        });
        res.on("end", () => {
            resolve(Buffer.concat(chunkdata));
        });
    });
    request.on("error", reject);
})
}


attest(
    "https://localhost:3000/identity",
    "sessionToken=53e3811cba403306a1ec20c97190f00f733c67682dd04f847e743e9decba3624"
)