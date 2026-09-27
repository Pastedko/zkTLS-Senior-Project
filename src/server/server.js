const https = require("https");
const fs = require("fs");
const { randomBytes } = require("node:crypto");
const identities = require("./identities");

const sessions = new Map();

function createCookieSession(userId) {
    const sessionToken = randomBytes(32).toString("hex");;
    sessions.set(sessionToken, userId);
    return sessionToken;
}

const server = https.createServer({
    key: fs.readFileSync("key.pem"),
    cert: fs.readFileSync("cert.pem")
}, (req, res) => {
    // if(req.url.startsWith("/identity/")){
    //     const id = req.url.split("/")[2];
    //     res.write(JSON.stringify(identities[id]));
    //     res.end();
    // }
    if (req.method === "GET" && req.url === "/identity") {
        const cookie = req.headers.cookie;
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
    console.log("Server running at http://localhost:3000");
});