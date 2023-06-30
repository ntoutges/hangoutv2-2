const https = require("https");

var sponsorId;
var accounts;
var config;

function init(lSponsorId, lAccounts, lConfig) {
  sponsorId = lSponsorId;
  accounts = lAccounts;
  config = lConfig;
}

function getUsers() {
  return new Promise((resolve,reject) => {
    const req = https.request(config["students-api-uri"], res => {
      let data = "";
      
      res.on("data", (chunk) => {
        data += chunk;
      });
      
      res.on("end", () => {
        const users = JSON.parse(data);
        const key = config["students-api-key"];
        const ids = [];
        for (const user of users) {
          ids.push(user[key]);
        }
        // resolve(ids);
        // resolve(["test17"])

        // convert id into username
        for (let i in ids) {
          ids[i] = generateUsername(ids[i]);
        }
        resolve(ids);
      })
    });
  
    req.on("error", (err) => {
      reject({
        "err": err.toString(),
        "code": 183,
        "type": `Error syncing with uri: ${config["students-api-uri"]}`
      });
    }).end();
  });
}

function doSync() {
  return new Promise((resolve,reject) => {
    console.log(`Retreiving data from ${config["students-api-uri"]}`);
    getUsers().then(userIds => {
      accounts.getNonAccounts(userIds).then(ids => {        
        if (ids.length == 0) { // no accounts need to be made
          console.log("No updates required");
          resolve([]);
          return;
        }

        const promises = [];
        console.log(`Generating ${ids.length} new accounts`);
        for (const id of ids) {
          const password = generatePassword(id);
          
          promises.push(
            accounts.createAccount(
              id, // what you login with
              password,
              config["root-account"],
            )
          );
        }
        
        Promise.all(promises).then(values => {
          console.log(`Generated ${ids.length} new accounts`)
          resolve(ids);
        }).catch(err => { reject(err); });
      }).catch(err => { reject(err) });
    }).catch(err => { reject(err) });
  });
}

function doContinuousSync(period) {
  doSync();
  setInterval(() => {
    doSync().then((ids) => {

    }).catch(err => {
      console.log("Error when running doSync");
      console.log(err);
    });
  },
    period
  );
}

function generateUsername(id) {
  return config["default-username"]
    .replace(/%i/g, id);
}

function generatePassword(username) {
  return config["default-password"]
    .replace(/%u/g, username)
    .replace(/%l/g, username.length.toString(10))
    .replace(/%n/g, username.length.toString(10) % 7 + 4);
}

exports.init = init;
exports.getUsers = getUsers;
exports.doSync = doSync;
exports.doContinuousSync = doContinuousSync;
exports.generatePassword = generatePassword;