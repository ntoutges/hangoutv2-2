var collection;
var transactions;
var accounts;

function init(transactionsLib, accountsLib, accountCollection) {
  transactions = transactionsLib;
  accounts = accountsLib;
  collection = accountCollection;
}

function ban(user, admin, expiration) {
  return new Promise((resolve,reject) => {
    accounts.exists(user).then((exists) => {
      if (!exists) {
        reject({
          "err": "User does not exist",
          "code": -127,
          "type": `user with id [${id}] does not exist`,
        });
      }
      transactions.createTransaction(
        [
          admin,
          user
        ],
        {
          "ban": user,
          "expires": expiration
        },
        "banned"
      ).then(id => {
        collection.update({ // notify user that they have been banned
          "_id": user
        }, {
          $push: {
            "bans": id
          }
        }, (err, updateCount) => {
          if (err) {
            reject({
              "err": err.toString(),
              "code": 129,
              "type": `Error when banning user`,
            });
            return;
          }
          if (updateCount == 0) {
            reject({
              "err": "User does not exist",
              "code": -130,
              "type": `unable to update user with id [${id}]`,
            });
            return;
          }
          resolve(id);
        });

        resolve(id);
      }).catch((err) => { reject(err); }); // propogate error
    }).catch((err) => { reject(err); }); // propogate error
  });
}

function unban(id) {
  return new Promise((resolve,reject) => {
    transactions.getTransaction(id).then((transaction) => {
      if (transaction.type != "banned") {
        reject({
          "err": "Invalid Transaction Type",
          "code": 131,
          "type": `Transaction with id [${id}] is not of type \"banned\"`,
        });
        return;
      }
      transactions.resolveTransaction(id, true).then((transaction) => {
        collection.update({
          "_id": transaction.data.ban
        }, {
          $pull: {
            "bans": id
          }
        }, (err, updatedNum) => {
          if (err) {
            reject({
              "err": err.toString(),
              "code": 132,
              "type": `Error when updating user [${id}] transaction data`,
            });
          }
          else if (updatedNum != 1) {
            reject({
              "err": "User does not exist",
              "code": -133,
              "type": `unable to update account with id [${id}]`,
            });
          }
          else resolve(transaction.data.ban);
        });
      }).catch(err => { reject(err); });  
    }).catch((err) => { reject(err); });
  });
}

// returns true if banned
function checkBanStatus(bans) {
  return new Promise((resolve,reject) => {
    const now = (new Date()).getTime();
    if (!bans || bans.length == 0) {
      resolve(false);
      return;
    }
    transactions.resolveTransactionsConditional(
      {
        "data.expires": {
          $lt: now
        },
        "_id": {
          $in: bans
        }
      }, 
      "banned"
    ).then((numRemoved) => {
      resolve(numRemoved != bans.length); // not all bans have been removed if true
    }).catch((err) => {
      reject(err);
    });
  })
}

exports.init = init;
exports.ban = ban;
exports.unban = unban;
exports.checkBanStatus = checkBanStatus;