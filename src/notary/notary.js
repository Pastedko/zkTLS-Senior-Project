const https = require("https");
const fs = require("fs");
const path = require("path");

const serverCertificate = fs.readFileSync(
    path.join(__dirname, "../server/cert.pem")
);

function makeRequest(address, cookie){
    const request = https.get(address, {
        headers: {
            "Cookie": cookie
        },
        ca: serverCertificate
    }, (res) => {
        let data = "";
        res.on("data", (chunk) => {
            data += chunk;
        });
        res.on("end", () => {
            console.log(data);
        });
    });
    request.on("error", (err) => {
        console.error("Error making request:", err);
    });
}

makeRequest(
    "https://localhost:3000/identity",
    "sessionToken=9d63b6b59b6ce459d475e0d8cc9e5ccccbe1eb16547668cd82b7c27f94bad7da"
)