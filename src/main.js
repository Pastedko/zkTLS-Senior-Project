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


        console.log("Enter a user ID (integer):");

        terminal.question("User ID: ", async (userIdInput) => {
            const userId = parseInt(userIdInput.trim(), 10);
            if (isNaN(userId)) {
                console.log("Invalid user ID. Please enter a valid integer.");
                terminal.close();
                return;
            }
            const user = identities.find(identity => identity.id === userId);
            policy.identity = { id: userId };
            if (!user) {
                console.log("User not found");
                terminal.close();
                return;
            }



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
                const cookie = await login(user.id, user.password);

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
            finally {
                terminal.close();

                if (globalThis.curve_bn128) {
                    await globalThis.curve_bn128.terminate();
                }
            }

        })
    })
}


async function executeBenchmark(policy) {
    terminal.close();

    const algorithms = ["sha256", "poseidon", "mimc"];
    const warmUpRuns = 2;
    const measuredRuns = 30;

    const user = identities.find(identity => identity.id === 1);
    const results = [];

    for (const algorithm of algorithms) {
        policy.algorithm = algorithm;
        policy.identity = { id: user.id };

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

        for (let run = 0; run < warmUpRuns; run++) {
            const result = await runSingleBenchmarkRun(user, policy, wasmPath, zkeyPath);
        }

        for(let run=0;run<measuredRuns;run++){
            const result = await runSingleBenchmarkRun(user, policy, wasmPath, zkeyPath);
            results.push({
                algorithm,
                run:run+1,
                ...result
            });

            
        }

        if (globalThis.curve_bn128) {
            await globalThis.curve_bn128.terminate();
        }
    }

    for(let algorithm of algorithms){
        const attempts=results.filter(
            results=>results.algorithm==algorithm
        );

        const successful=attempts.filter(result=>result.success);
        const failures=attempts.length-successful.length;

        const averageProof=successful.reduce((sum,result)=>sum+=result.proofTimeMs,0)/successful.length;
        const proofStats=timeCalculationHelper(successful.map(result=>result.proofTimeMs));
        const averageVerification=successful.reduce((sum,result)=>sum+=result.verificationTimeMs,0)/successful.length;
        const verificationStats=timeCalculationHelper(successful.map(result=>result.verificationTimeMs));
        const averageProofSize=successful.reduce((sum,result)=>sum+=result.proofSizeBytes,0)/successful.length;
        const sizeStats=timeCalculationHelper(successful.map(result=>result.proofSizeBytes));
        const averageArtifactSize=successful.reduce((sum,result)=>sum+=result.artifactSizeBytes,0)/successful.length;
        
        console.log("Algorithm: "+algorithm);
        console.log("Successful runs: "+successful.length+" Failed runs: "+failures);
        console.log("Average proof time: "+averageProof);
        console.log("Average verification time: "+averageVerification);
        console.log("Average proof size: "+averageProofSize);

        
    }
    const resultsPath=path.join(__dirname,"../build/benchmark_results.json");
        fs.writeFileSync(resultsPath,JSON.stringify(results));
    const csvRows=[
        "algorithm,run,success,proofTimeMs,verificationTimeMs,proofSizeBytes,artifactSizeBytes",
        ...results.map(result=>[
            result.algorithm,
            result.run,
            result.success,
            result.proofTimeMs,
            result.verificationTimeMs,
            result.proofSizeBytes,
            result.artifactSizeBytes
        ].join(","))
    ];

    const csvPath=path.join(__dirname,"../build/benchmark_results.csv");

    fs.writeFileSync(csvPath,csvRows.join("\n"));
}

async function runSingleBenchmarkRun(user, policy, wasmPath, zkeyPath) {
    let proofTimeMs = null;
    let verificationTimeMs = null;
    let proofSizeBytes=null;
    let artifactSizeBytes=null;

    try {
        const cookie = await login(user.id, user.password);
        const notaryResponse = await attest(policy.serverAddress, cookie, policy.algorithm);
        const proofStart = process.hrtime.bigint();
        const artifact = await generateProof(notaryResponse, policy.cutoffDate, wasmPath, zkeyPath, policy.algorithm);
        proofTimeMs = Number(process.hrtime.bigint() - proofStart) / 1000000;
        proofSizeBytes=Buffer.byteLength(JSON.stringify(artifact.proof),"utf8");
        artifactSizeBytes = Buffer.byteLength(JSON.stringify(artifact),"utf8");
        const verificationStart = process.hrtime.bigint();
        const valid = await verifyProof(artifact, policy);
        verificationTimeMs = Number(process.hrtime.bigint() - verificationStart) / 1000000;


        return {
            success: valid,
            proofTimeMs,
            verificationTimeMs,
            proofSizeBytes,
            artifactSizeBytes,
            error: valid ? null : "Invalid proof"
        };
    }
    catch (err) {
        return {
            success: false,
            proofTimeMs,
            verificationTimeMs,
            proofSizeBytes,
            artifactSizeBytes,
            error: err.message
        };
    }
}

function timeCalculationHelper(values){
    const mean=values.reduce((sum,value)=>sum+=value,0)/values.length;
    const standardDev=Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/(values.length-1));

    return{
        min:Math.min(...values),
        max:Math.max(...values),
        standardDev
    }
}


main();