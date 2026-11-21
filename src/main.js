const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const { attest } = require("./notary/notary");
const { generateProof } = require("./prover/prover");
const { verifyProof } = require("./verifier/verifier");
const identities = require("./server/identities.json");
    const terminal = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
const serverCertificate = fs.readFileSync(path.join(__dirname, "server/keys/cert.pem"));

function login(id, password) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ id, password });
        const request = https.request("https://localhost:3000/login", {
            method: "POST",
            ca: serverCertificate,
            headers: {
                "Content-Type": "application/json"
            },
        }, (response) => {
            response.resume();

            if (response.statusCode != 200) {
                reject(new Error("Login failed"));
                return;
            }

            const sessionCookie = response.headers["set-cookie"]?.find(cookie => cookie.startsWith("sessionToken="));
            if (!sessionCookie) {
                reject(new Error("Server did not return a session cookie"));
                return;
            }

            resolve(sessionCookie.split(";")[0]);
        });
        request.on("error", reject);
        request.end(body);
    })
}

async function main() {
    const id = 1;
    const password = "securepass456";

    const policy = {
        serverAddress: "https://localhost:3000/identity",
        cutoffDate: "20081023",
    };



    console.log("Select an execution type:");
    console.log("1. Single execution");
    console.log("2. Benchmark execution");

    terminal.question("Enter your choice (1 or 2): ", async (choice) => {
        const answer = choice.trim();
        if (answer === "1") {
            await executeSingle(policy);
        } else if (answer === "2") {
            await executeBenchmark(policy);
        }
        terminal.close();
    });
}

async function executeSingle(policy) {
    console.log("Choose a hashing algorithm:");
    console.log("1. SHA-256");
    console.log("2. Poseidon");
    console.log("3. MiMC");

    terminal.question("Enter your choice (1, 2, or 3): ", async (algorithmChoice) => {
        const answer = algorithmChoice.trim();
        switch (answer) {
            case "1":
                policy.algorithm = "sha256";
                break;
            case "2":
                policy.algorithm = "poseidon";
                break;
            case "3":
                policy.algorithm = "mimc";
                break;
            default:
                console.log("Invalid choice. Defaulting to MiMC.");
                policy.algorithm = "mimc";
        }
    })

    console.log("Enter a user ID (integer):");

    terminal.question("User ID: ", (userIdInput) => {
        const userId = parseInt(userIdInput.trim(), 10);
        if (isNaN(userId)) {
            console.log("Invalid user ID. Please enter a valid integer.");
            terminal.close();
            return;
        }
        const user=identities.find(identity => identity.id === userId);
        policy.identity=userId;
        if (!user) {
            console.log("User not found");
            terminal.close();
            return;
        }
    })

  
    let wasmPath, zkeyPath;

    switch (policy.algorithm) {
        case "sha256":
            wasmPath = path.join(__dirname, "prover/circuits/sha256/age_sha256_js/age_sha256.wasm");
            zkeyPath = path.join(__dirname, "../build/sha256/age_sha256_final.zkey");
            break;
        case "poseidon":
            wasmPath = path.join(__dirname, "prover/circuits/poseidon/age_poseidon_js/age_poseidon.wasm");
            zkeyPath = path.join(__dirname, "../build/poseidon/age_poseidon_final.zkey");
            break;
        case "mimc":
            wasmPath = path.join(__dirname, "prover/circuits/mimc/age_mimc_js/age_mimc.wasm");
            zkeyPath = path.join(__dirname, "../build/mimc/age_mimc_final.zkey");
            break;
    }

    try {
        const cookie = await login(id, user.password);

        const notaryResponse = await attest(policy.serverAddress, cookie, policy.algorithm);

        const artifact = await generateProof(notaryResponse, policy.cutoffDate, wasmPath, zkeyPath, policy.algorithm);

        const valid = await verifyProof(artifact, policy);

        if (valid) {
            console.log("Proof is valid")
        }
        else {
            console.log("Proof is invalid");
        }
    }
    catch (err) {
        console.log(err);
        console.log("Proof generation failed: invalid proof or inputs");
    }
}


function executeBenchmark(policy, id, password) {
    console.log("benchmark execution");
}


main();