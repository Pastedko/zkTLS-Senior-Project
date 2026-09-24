const https=require("https");
const fs=require("fs");
const identities = require("./identities");


const server = https.createServer({
    key: fs.readFileSync("key.pem"),
    cert: fs.readFileSync("cert.pem")
}, (req,res)=>{
    if(req.url.startsWith("/identity/")){
        const id = req.url.split("/")[2];
        res.write(JSON.stringify(identities[id]));
        res.end();
    }
})

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});