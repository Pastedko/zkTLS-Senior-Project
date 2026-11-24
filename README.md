# zkTLS Senior Project

A local age-verification prototype comparing SHA-256, Poseidon and MiMC commitments in Groth16 circuits.

The system uses a trusted-notary attested-fetch model rather than MPC-based zkTLS. The notary receives a session cookie, retrieves the identity record in plaintext, and signs its commitment and server address.

## Requirements

The project was developed on Windows using:

- Node.js 20.11.0
- npm 10.2.4
- Circom compiler 2.2.3 through the circom2 npm package
- snarkjs 0.7.6
- circomlibjs 0.1.7 for reference tests
- OpenSSL available in the terminal

Commands below are intended for PowerShell and should be run from the project root unless stated otherwise.

## Install Dependencies

```powershell
npm ci
```

## Generate Local Keys

Keys and certificates are generated locally and excluded from version control.

Create their directories:

```powershell
New-Item -ItemType Directory -Force -Path src/notary/keys, src/server/keys
```

Generate the notary's Ed25519 key pair:

```powershell
openssl genpkey -algorithm Ed25519 -out src/notary/keys/private.pem
openssl pkey -in src/notary/keys/private.pem -pubout -out src/notary/keys/public.pem
```

Generate the HTTPS server's private key and self-signed localhost certificate:

```powershell
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 -keyout src/server/keys/key.pem -out src/server/keys/cert.pem -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

These commands are for local development. Regenerating the notary key pair invalidates attestations signed with the previous key. Restart running processes after replacing keys or certificates.

## Compile the Age Circuits

Compile each hashing configuration:

```powershell
Set-Location src/prover/circuits/sha256
& "../../../../node_modules/.bin/circom2.cmd" age_sha256.circom -l "." --r1cs --wasm --sym
Set-Location "../../../.."

Set-Location src/prover/circuits/poseidon
& "../../../../node_modules/.bin/circom2.cmd" age_poseidon.circom -l "." --r1cs --wasm --sym
Set-Location "../../../.."

Set-Location src/prover/circuits/mimc
& "../../../../node_modules/.bin/circom2.cmd" age_mimc.circom -l "." --r1cs --wasm --sym
Set-Location "../../../.."
```

Each compilation produces an R1CS file, a symbol file and an `_js` directory containing the WebAssembly witness calculator.

When rebuilding with the installed circom2 package, rename the existing generated `_js` directory first if compilation stalls while overwriting it. Confirm that compilation explicitly reports successful WASM generation.

## Prepare Powers of Tau

Create the output directories:

```powershell
New-Item -ItemType Directory -Force -Path build/sha256, build/poseidon, build/mimc
```

Generate the initial parameters:

```powershell
.\node_modules\.bin\snarkjs.cmd powersoftau new bn128 18 build/sha256/pot18_0000.ptau -v
```

Add a contribution, entering fresh entropy when prompted:

```powershell
.\node_modules\.bin\snarkjs.cmd powersoftau contribute build/sha256/pot18_0000.ptau build/sha256/pot18_0001.ptau --name="Local development contribution" -v
```

Prepare the parameters for circuit-specific setup:

```powershell
.\node_modules\.bin\snarkjs.cmd powersoftau prepare phase2 build/sha256/pot18_0001.ptau build/sha256/pot18_final.ptau -v
```

Verify the prepared file:

```powershell
.\node_modules\.bin\snarkjs.cmd powersoftau verify build/sha256/pot18_final.ptau
```

The prepared file is reused for all three configurations. This is a local development setup, not an independently administered multiparty ceremony.

## Generate Circuit-Specific Keys

Run the following from the project root after compilation and Powers of Tau preparation.

Each configuration requires its own proving and verification keys. Enter fresh entropy when each contribution command prompts for it.

```powershell
foreach ($algorithm in @("sha256", "poseidon", "mimc")) {
    $circuit = "src/prover/circuits/$algorithm/age_$algorithm.r1cs"
    $initialKey = "build/$algorithm/age_${algorithm}_0000.zkey"
    $finalKey = "build/$algorithm/age_${algorithm}_final.zkey"
    $verificationKey = "build/$algorithm/verification_key.json"
    $ptau = "build/sha256/pot18_final.ptau"

    & ".\node_modules\.bin\snarkjs.cmd" groth16 setup $circuit $ptau $initialKey
    if ($LASTEXITCODE -ne 0) { throw "Setup failed: $algorithm" }

    & ".\node_modules\.bin\snarkjs.cmd" zkey contribute $initialKey $finalKey --name="$algorithm local contribution" -v
    if ($LASTEXITCODE -ne 0) { throw "Contribution failed: $algorithm" }

    & ".\node_modules\.bin\snarkjs.cmd" zkey export verificationkey $finalKey $verificationKey
    if ($LASTEXITCODE -ne 0) { throw "Key export failed: $algorithm" }

    & ".\node_modules\.bin\snarkjs.cmd" zkey verify $circuit $ptau $finalKey
    if ($LASTEXITCODE -ne 0) { throw "Key verification failed: $algorithm" }
}
```

Each configuration should report `ZKey Ok!`.

Changing a circuit requires recompilation and regeneration of its circuit-specific keys. The prepared Powers of Tau file can be reused if its capacity remains sufficient.

## Run the Application

Start the HTTPS server in the first terminal:

```powershell
Set-Location src/server
node server.js
```

Leave that terminal running. In a second terminal, navigate to the project root and run:

```powershell
node src/main.js
```

Select either:

1. Single execution, followed by a hash selection and user ID.
2. Benchmark execution, which evaluates all three configurations.

Benchmark results are written to:

- `build/benchmark_results.json`
- `build/benchmark_results.csv`

Each benchmark execution overwrites these files. Tables and graphs are prepared separately in Excel.

Stop the server with Ctrl+C when finished.

## Compile the Test Circuits

The hash-circuit tests require generated WebAssembly witness calculators. Compile these from the project root:

```powershell
Push-Location tests/prover/sha256
& "../../../node_modules/.bin/circom2.cmd" sha256_compress_test.circom -l "../../../src/prover/circuits/sha256" --r1cs --wasm --sym
Pop-Location

Push-Location tests/prover/poseidon
& "../../../node_modules/.bin/circom2.cmd" poseidon_hash_test.circom -l "../../../src/prover/circuits/poseidon" --r1cs --wasm --sym
Pop-Location

Push-Location tests/prover/mimc
& "../../../node_modules/.bin/circom2.cmd" mimc_hash_test.circom -l "../../../src/prover/circuits/mimc" --r1cs --wasm --sym
Pop-Location
```

These test circuits do not require their own proving keys. Complete age-circuit and verifier tests use the age-circuit artifacts and keys generated earlier.

If rebuilding stalls while overwriting an existing generated `_js` directory, rename that directory and compile again.

## Run the Tests

Before running the suite:

- Install dependencies.
- Generate the local notary keys and TLS certificate.
- Compile the age circuits and test circuits.
- Generate the age circuits' proving and verification keys.
- Start the HTTPS identity server in a separate terminal.

From the project root:

```powershell
npm test
```

The suite covers server authentication and identity access, hash-reference comparisons, JavaScript–Circom consistency, age-circuit checks and verifier acceptance/rejection cases.

A successful run currently reports 29 passing tests. Some test functions contain multiple assertions. Automated verifier tests use a Poseidon proof; session expiration is not covered.

A server connection error means the HTTPS integration tests could not reach the server. Missing generated files indicate that the compilation or setup steps must be completed.

## Third-Party Parameters and References

The Poseidon round constants and mixing matrix, and the MiMC7 round constants, use the parameters provided by iden3/circomlibjs version 0.1.7.

- Repository: https://github.com/iden3/circomlibjs
- Upstream package licence: GPL-3.0
- Poseidon parameters: src/poseidon_constants.json in that package
- MiMC7 parameter generation: src/mimc7.js in that package

These parameters are not original contributions of this project. The project contains manually implemented JavaScript and Circom computations using them. circomlibjs is also used as an external reference in automated tests.

Research references:
- Poseidon: Grassi et al., “Poseidon: A New Hash Function for Zero-Knowledge Proof Systems” (2021).
- MiMC: Albrecht et al., “MiMC: Efficient Encryption and Cryptographic Hashing with Minimal Multiplicative Complexity” (2016).