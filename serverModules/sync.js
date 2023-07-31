const https = require("https");

var accounts;
var config;
var env;
var logger;

function init(lAccounts, lConfig, lEnv, lLogger) {
  accounts = lAccounts;
  config = lConfig;
  env = lEnv;
  logger = lLogger;
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
    logger.log(`Retreiving data from ${config["students-api-uri"]}`);
    getUsers().then(userIds => {
      accounts.getNonAccounts(userIds).then(ids => {        
        if (ids.length == 0) { // no accounts need to be made
          logger.log("No updates required");
          resolve([]);
          return;
        }

        const promises = [];
        logger.log(`Generating ${ids.length} new accounts`);
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
          logger.log(`Generated ${ids.length} new accounts`)
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
      logger.log("Error when running doSync");
      logger.log(err);
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
    .replace(/%l/g, username.length.toString(10) * (+env.apLenMul))
    .replace(/%n/g, username.length.toString(10) % (+env.apLenMod) + (+env.apLenOff));
}

exports.init = init;
exports.getUsers = getUsers;
exports.doSync = doSync;
exports.doContinuousSync = doContinuousSync;
exports.generateUsername = generateUsername;
exports.generatePassword = generatePassword;