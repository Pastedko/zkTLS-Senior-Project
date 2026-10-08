const {Buffer} = require('node:buffer');

function sha256(inputBytes,randomness){
    const messageBytes = Buffer.concat([inputBytes,randomness]);
    const paddedMessage = padMessage(messageBytes);
    const messageSchedule = createMessageSchedule(paddedMessage);
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


export { sha256 };