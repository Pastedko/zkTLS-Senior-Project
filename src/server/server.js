const https = require("https");
const fs = require("fs");
const { Buffer } = require("node:buffer");
const { randomBytes } = require("node:crypto");
const identities = require("./identities");

const sessions = new Map();

function createCookieSession(userId) {
    const sessionToken = randomBytes(32).toString("hex");;
    sessions.set(sessionToken, userId);
    return sessionToken;
}

function getUserFromSession(req) {
    const cookie = (req.headers.cookie || "")
        .split(";")
        .map(part => part.trim())
        .find(part => part.startsWith("sessionToken="));

        if (!cookie) {
            return;
        }
        const token = cookie.slice("sessionToken=".length);
        const userId = sessions.get(token);
        const user = identities.find(u => u.id === userId);
        return user;
}

const server = https.createServer({
    key: fs.readFileSync("key.pem"),
    cert: fs.readFileSync("cert.pem")
}, (req, res) => {

    if (req.method === "GET" && req.url === "/identity") {
        const user=getUserFromSession(req);
        if(!user){
            res.statusCode = 401;
            res.write("Unauthorized");
            res.end();
            return;
        }
        const response = JSON.stringify({ id: user.id, name: user.name, birthdate: user.birthDate });
        res.write(response);
        console.log("Response length:", Buffer.byteLength(response));
        res.end();
    }

    if (req.method === "POST" && req.url === "/login") {
        let body = "";
        req.on("data", chunk => {
            body += chunk.toString();
        });
        req.on("end", () => {
            const { id, password } = JSON.parse(body);
            const user = identities.find(u => u.id === id && u.password === password);
            if (user) {
                const sessionToken = createCookieSession(user.id);

                res.setHeader(
                    "Set-Cookie",
                    `sessionToken=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/`
                );

                res.write("Login successful");
            } else {
                res.statusCode = 401;
                res.write("Invalid credentials");
            }
            res.end();
        });
    }
})

server.listen(3000, () => {
    console.log("Server running at https://localhost:3000");
});