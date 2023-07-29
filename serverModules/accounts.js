const bcrypt = require('bcrypt');

var collection;
var api;
var config;
const sessions = {};

function init(userCollection, dbAPI, lConfig) {
  collection = userCollection;
  api = dbAPI;
  config = lConfig;
}

const DEFAULT_PERMISSIONS = ["login"]

function verifyAccountIdentity(username, password) {
  return new Promise((resolve,reject) => {
    api.findOne(
      collection, {
        "_id": username
      }, (err, doc) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 182,
            "type": `Error trying to access user account with id [${username}]`,
          });
          return;
        }
        if (!doc) {
          reject({
            "err": "username",
            "code": -115,
            "type": `user with id [${username}] does not exist`,
          });
          return;
        }
        let passwordHash = doc.pass;
        bcrypt.compare(password, passwordHash, function(err, matches) {
          if (err) {
            reject({
              "err": err.toString(),
              "code": 116,
              "type": "Error when checking password",
            });
          }
          if (matches) resolve(doc); // password correct
          else reject({
            "err": "password",
            "code": -117,
            "type": `invalid password`,
          });
        });
      }
    )
  });
}

function createAccount(username, password, sponsor, name=null) {
  if (name == null) name = username;

  return new Promise((resolve,reject) => {
    api.findOne(
      collection, {
        "_id": username
      }, (err,doc) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 118,
            "type": `Error searching for account with id [${username}]`,
          });
          return;
        }
        if (doc) { // user already exists
          reject({
            "err": "Document already exists",
            "code": -119, // non-critical -- username having been taken will not take down the server
            "type": `document with id [${username}] already exist`,
          });
          return;
        }
        
        bcrypt.hash(password, parseInt(config["salting-rounds"])).then(hashPassword => {
          api.insert(
            collection, {
              "_id": username,
              "name": name,
              "pass": hashPassword,
              "sponsor": sponsor,
              "bans": [],
              "perms": DEFAULT_PERMISSIONS
            }, (err, docId) => {
              if (err) { // something bad happened?
                reject({
                  "err": err.toString(),
                  "code": 120,
                  "type": `Error creating new account`,
                });
              }
              else resolve();
            }
          );
        }).catch(err => {
          reject({
            "err": err.toString(),
            "code": 121,
            "type": "Error generating password hash",
          });
        });
      }
    );
  });
}

function getSessionValues(user) {
  const permissions = {};
  if ("perms" in user) {
    for (let permission of user.perms) { permissions[permission] = true; } // convert db array into object
  }
  
  const values = {
    "user": user._id,
    "name": user.name ?? user._id, // use _id as fallback
    "perms": permissions
  }
  return values;
}

function addSession(user, session, sessionId) {
  const data = {
    session,
    "id": sessionId,
    "init": (new Date()).getTime()
  };
  if (user in sessions) sessions[user].push(data);
  else sessions[user] = [data];
}

function removeSession(user, session) {
  if (!(user in sessions)) { return false; } // don't need to remove that which doesn't exist // nothing removed
  for (let i in sessions[user]) {
    if (sessions[user][i].session == session) {
      sessions[user].splice(i,1); // remove session data
      return true;
    }
  }
  return false; // nothing removed
}

function getSessions(user) {
  if (user in sessions) return sessions[user];
  return []; // no sessions to return
}

function getAccount(user) {
  return new Promise((resolve,reject) => {
    api.findOne(
      collection, {
        "_id": user
      }, (err,doc) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 114,
            "type": `Error trying to access user account with id [${user}]`,
          });
          return;
        }
  
        if (!doc) {
          reject({
            "err": "Invalid user id",
            "code": -180,
            "type": `unable to find user account with id [${user}]`,
          });
        }
        resolve(doc);
      }
    );
  });
}

// returns user ids who do not exist in the database
function getNonAccounts(users) {
  return new Promise((resolve,reject) => {
    api.findWProjection(
      collection, {}, {
        "_id": 1, // only return _id field
        "name": 1 // need to have a second field due to _id being weird
      }, (err, docs) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 185,
            "type": `Error finding user accounts not already created`,
          });
          return;
        }
        
        // create dictionary to easily check if id exists
        const ids = {};
        for (let doc of docs) {
          ids[doc._id] = true;
        }

        // collect users that don't exist to return later
        const nonAccounts = [];
        for (const userId of users) {
          if (!(userId in ids)) { // user doesn't yet exist
            nonAccounts.push(userId);
          }
        }

        resolve(nonAccounts);
      }
    );
  });
}

function exists(user) {
  return new Promise((resolve,reject) => {
    getAccount(user).then(doc => {
      resolve(true);
    }).catch(err => {
      if (err.code < 0) resolve(false); // account doesn't exist
      else reject(err); });
  });
}

function addPermission(user, permission) {
  return new Promise((resolve, reject) => {
    api.update(
      collection, {
        "_id": user
      }, {
        $addToSet: {
          "perms": permission
        }
      }, (err, amountUpdated) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 176,
            "type": `Error trying to add permissions to user account with id [${user}]`,
          });
          return;
        }
        if (amountUpdated == 0) {
          reject({
            "err": "User account does not exist",
            "code": -177,
            "type": `unable to find user with id [${user}] trying to add permissions`,
          });
          return;
        }
        resolve();
      }
    )
  });
}

function removePermission(user, permission) {
  return new Promise((resolve, reject) => {
    api.update(
      collection, {
        "_id": user
      }, {
        $pull: {
          "perms": permission
        }
      }, (err, amountUpdated) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 178,
            "type": `Error trying to remove permissions of user account with id [${user}]`,
          });
          return;
        }
        if (amountUpdated == 0) {
          reject({
            "err": "User account does not exist",
            "code": -179,
            "type": `unable to find user with id [${user}] trying to to remove permissions`,
          });
          return;
        }
        resolve();
      }
    );
  });
}

exports.init = init;
exports.verifyAccountIdentity = verifyAccountIdentity
exports.createAccount = createAccount;
exports.getSessionValues = getSessionValues;
exports.getAccount = getAccount;
exports.getNonAccounts = getNonAccounts;
exports.exists = exists;
exports.addSession = addSession;
exports.removeSession = removeSession;
exports.getSessions = getSessions;
exports.addPermission = addPermission;
exports.removePermission = removePermission;