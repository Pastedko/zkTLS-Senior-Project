const { test } = require("node:test");
const assert = require("node:assert/strict");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const identities = require("../../src/server/identities.json");

const certificate = fs.readFileSync(
    path.join(__dirname, "../../src/server/keys/cert.pem")
);

function sendRequest(method, endpoint, body, cookie){
    return new Promise((resolve,reject)=>{
        const headers = {};

        if(body!==undefined){
            headers["Content-Type"]="application/json";
        }

        if(cookie){
            headers.Cookie=cookie;
        }

        const request=https.request(`https://localhost:3000${endpoint}`,{
            method,ca:certificate,headers},
            response=>{
                let responseBody="";

                response.setEncoding("utf8");
                response.on("data",chunk=>{
                    responseBody+=chunk;
                })

                response.on("error",reject);
                response.on("end",()=>{
                    resolve({
                        status:response.statusCode,
                        headers:response.headers,
                        body:responseBody
                    });
                });
        });

        request.on("error",reject);
        request.setTimeout(5000,()=>{
            request.destroy(new Error("Request timed out"));
        });

        request.end(
            body==undefined?undefined:JSON.stringify(body)
        );
    })
}

test("valid login creates a session cookie",async()=>{
    const user=identities.find(identity=>identity.id==1);

    const response = await sendRequest("POST","/login",{
        id:user.id,
        password:user.password
    });

    assert.equal(response.status,200);

    const cookie=response.headers["set-cookie"]?.find(value=>value.startsWith("sessionToken="));

    assert.ok(cookie,"Server must return a session cookie");
})

test("invalid passowrd is rejected",async()=>{
    const user = identities.find(identity => identity.id === 1);

    const response = await sendRequest("POST", "/login", {
        id: user.id,
        password: "wrong password"
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers["set-cookie"], undefined);
});

test("unexisitng user is rejected",async()=>{
    const unknownId = -1

    const response = await sendRequest("POST", "/login", {
        id: unknownId,
        password: "wrong password"
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers["set-cookie"], undefined);
});

test("identity request without a session cookie is rejected",async()=>{
    const response = await sendRequest("GET", "/identity");

    assert.equal(response.status, 401);
    assert.equal(response.body, "Unauthorized");
})

test("identity request with an unknown cookie is rejected", async () => {
    const response = await sendRequest(
        "GET",
        "/identity",
        undefined,
        `sessionToken=${"0sd13215as5d13f2as1d65"}`
    );

    assert.equal(response.status, 401);
    assert.equal(response.body, "Unauthorized");
});

test("valid session returns correct identity response", async () => {
    const user = identities.find(identity => identity.id === 1);

    const loginResponse = await sendRequest("POST", "/login", {
        id: user.id,
        password: user.password
    });

    assert.equal(loginResponse.status, 200);

    const sessionCookie = loginResponse.headers["set-cookie"]
        .find(cookie => cookie.startsWith("sessionToken="))
        .split(";")[0];

    const response = await sendRequest(
        "GET",
        "/identity",
        undefined,
        sessionCookie
    );

    assert.equal(response.status, 200);

    const expected = JSON.stringify({
        id: user.id,
        name: user.name,
        birthdate: user.birthDate
    });

    assert.equal(response.body, expected);
});