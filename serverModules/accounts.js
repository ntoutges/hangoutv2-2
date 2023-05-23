const bcrypt = require('bcrypt');
const { remove } = require('./friends');
const res = require('express/lib/response');

var collection;
const sessions = {};

function init(userCollection) {
  collection = userCollection;
}

function verifyAccountIdentity(username, password) {
  return new Promise((resolve,reject) => {
    collection.findOne({
      "_id": username
    }, (err, doc) => {
      if (err) {
        reject({
          "err": err.toString(),
          "code": 114,
          "type": `Error trying to access user account with id [${username}]`,
        });
        return;
      }
      if (!doc) {
        reject({
          "err": "username",
          "code": -115,
          "type": `user with id [${id}] does not exist`,
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
    });
  })
}

function createAccount(username, password, saltRounds) {
  return new Promise((resolve,reject) => {
    collection.findOne({
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
          "type": `document with id [${id}] already exist`,
        });
        return;
      }
      
      bcrypt.hash(password, saltRounds).then(hashPassword => {
        collection.insert({
          "_id": username,
          "name": username,
          "pass": hashPassword
        }, (err, doc) => {
          if (err) { // something bad happened?
            reject({
              "err": err.toString(),
              "code": 120,
              "type": `Error creating new account`,
            });
          }
          else resolve();
        });
      }).catch(err => {
        reject({
          "err": err.toString(),
          "code": 121,
          "type": "Error generating password hash",
        });
      });
    });
  });
}

function getSessionValues(user) {
  const values = {
    "user": user._id,
    "name": user.name ?? user._id, // use _id as fallback
    "admin": user.admin ?? 0 // assumed no level of admin
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

function exists(user) {
  return new Promise((resolve,reject) => {
    collection.findOne({
      "_id": user
    }, (err,doc) => {
      if (err) {
        reject({
          "err": err.toString(),
          "code": 114,
          "type": `Error trying to access user account with id [${username}]`,
        });
        return;
      }
      resolve(!!doc);
    });
  });
}

exports.init = init;
exports.verifyAccountIdentity = verifyAccountIdentity
exports.createAccount = createAccount;
exports.getSessionValues = getSessionValues;
exports.exists = exists;
exports.addSession = addSession;
exports.removeSession = removeSession;
exports.getSessions = getSessions;
