const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const snarkjs = require('snarkjs');

test("SHA256 compress", async () => {
    const message = Buffer.from("abc");

    assert.ok(message.length < 55);

    const padded = Buffer.alloc(64);
    message.copy(padded);
    padded[message.length] = 0x80;
    padded.writeBigUInt64BE(BigInt(message.length) * 8n, 56);

    const block = [];

    for (let i = 0; i < 16; i++) {
        block.push(padded.readUint32BE(i * 4));
    }

    const hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    const wasmPath = path.join(
        "sha256_compress_test_js",
        "sha256_compress_test.wasm"
    );

    const witnessPath = "sha256_compress_test.wtns";

    await snarkjs.wtns.calculate({ hash, block }, wasmPath, witnessPath);

    const witness = await snarkjs.wtns.exportJson(witnessPath);
    const actual = Buffer.alloc(32);

    for (let i = 0; i < 8; i++) {
        actual.writeUInt32BE(Number(witness[i + 1]), i * 4);
    }

    const expected = createHash("sha256")
        .update(message)
        .digest();

    assert.deepEqual(actual, expected);
})