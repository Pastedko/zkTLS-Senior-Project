const {Buffer} = require('node:buffer');

function sha256(inputBytes,randomness){

    //fixed initial hash values used in SHA-256, factorial parts of the first 8 prime numbers
    const hashState = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    const messageBytes = Buffer.concat([inputBytes,randomness]);
    const paddedMessage = padMessage(messageBytes);

    for (let i = 0; i < paddedMessage.length; i += 64) {
        const block = paddedMessage.subarray(i, i + 64);

        const messageSchedule = createMessageSchedule(block);

        compressBlock(messageSchedule, hashState);
    }

    const digest = Buffer.alloc(32);
    for (let i = 0; i < 8; i++) {
        digest.writeUInt32BE(hashState[i], i * 4);
    }

    return digest;
}

function padMessage(messageBytes) {{
    // Calculate the total length of the padded message
    // original length + 1 byte for the '1' bit + 8 bytes for the length of the initial message
    const totalLength = Math.ceil((messageBytes.length + 9  + 64) / 64) * 64;

    // Create a new empty buffer with the total length
    const paddedMessage = Buffer.alloc(totalLength);

    // Copy the original message into the new buffer
    messageBytes.copy(paddedMessage);

    // Append the '1' bit (0x80 in hex)
    paddedMessage[messageBytes.length] = 0x80;

    // The length of the original message in bits, 1 byte = 8 bits, so we multiply by 8
    const originalBitLength = messageBytes.length * 8;

    // Write the original length in bits as a 64-bit big-endian integer at the end of the padded message
    paddedMessage.writeBigUInt64BE(BigInt(originalBitLength), totalLength - 8);

    return paddedMessage;
}

function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount)) >>> 0;
}

function createMessageSchedule(paddedMessage) {
    const words = new Uint32Array(64);

    //Read the initial 16 words from the padded message
    for (let i = 0; i < 16; i++) {
        words[i] = paddedMessage.readUInt32BE(i * 4);
    }

    //Extend the first 16 words into the remaining 48 words
    for (let i = 16; i < 64; i++) {
        const x = words[i - 15];
        const y = words[i - 2];

        const sigma0 = rightRotate(words[x], 7) ^ rightRotate(words[x], 18) ^ (words[x] >>> 3);
        const sigma1 = rightRotate(words[y], 17) ^ rightRotate(words[y], 19) ^ (words[y] >>> 10);
        words[i] = (words[i - 16] + sigma0 + words[i - 7] + sigma1) >>> 0;
    }

    return words;
}

function compressBlock(words, hash) {

    // Fixed initial hash values used in SHA-256
    const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

    let [a, b, c, d, e, f, g, h] = hash;

    for(let i =0;i<64;i++){
        const sum1 =  rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);

        //choose f's bits when e's bit is 1
        //otherwise choose g's bits
        const choice = (e & f) ^ (~e & g);

        const temp1 = (h + sum1 + choice + SHA256_K[i] + words[i]) >>> 0;

        const sum0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);

        //select the majority bit from a, b, c
        const majority = (a & b) ^ (a & c) ^ (b & c);

        const temp2 = (sum0 + majority) >>> 0;

        //update the working variables for the next iteration
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
    }

    const result = [a, b, c, d, e, f, g, h];

    for (let i = 0; i < 8; i++) {
        hash[i] = (hash[i] + result[i]) >>> 0;
    }

    return hash;
}
}

module.exports = sha256;
