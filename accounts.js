const bcrypt = require('bcrypt');

var collection;

function init(userCollection) {
  collection = userCollection;
}

function verifyAccountIdentity(username, password) {
  return new Promise((resolve,reject) => {
    collection.findOne({
      "_id": username
    }).exec((err, doc) => {
      if (err) {
        reject(err);
        return;
      }
      if (!doc) {
        reject("username"); // user doesn't exist (username wrong)
        return;
      }
      let passwordHash = doc.pass;
      bcrypt.compare(password, passwordHash, function(err, matches) {
        if (err) {
          reject(err);
          return;
        }
        if (matches) resolve(doc); // password correct
        else reject("password") // password doesn't match
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
        reject(err);
        return;
      }
      if (doc) { // user already exists
        reject("user already exists");
        return;
      }
      
      bcrypt.hash(password, saltRounds).then(hashPassword => {
        collection.insert({
          "_id": username,
          "name": username,
          "pass": hashPassword
        }, (err, doc) => {
          if (err) reject(err); // something bad happened?
          else resolve();
        });
      }).catch(err => { reject(err) });
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

exports.init = init;
exports.verifyAccountIdentity = verifyAccountIdentity
exports.createAccount = createAccount;
exports.getSessionValues = getSessionValues;