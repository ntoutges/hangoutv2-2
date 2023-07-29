var collection;
var transactions;
var accounts;
var api;
var logger;

function init(transactionsLib, accountsLib, accountCollection, dbAPI, lLogger) {
  transactions = transactionsLib;
  accounts = accountsLib;
  collection = accountCollection;
  api = dbAPI;
  logger = lLogger;
}

function ban(user, admin, expiration, restrictions=["login"]) {
  return new Promise((resolve,reject) => {
    accounts.getAccount(user).then((account) => {
      if (!account) {
        reject({
          "err": "User does not exist",
          "code": -127,
          "type": `user with id [${id}] does not exist`,
        });
      }

      restrictions = stringwiseAnd(restrictions, account.perms);
      transactions.createTransaction(
        [
          admin,
          user
        ],
        {
          "ban": user,
          "expires": expiration,
          "restr": restrictions
        },
        "banned"
      ).then(id => {
        api.update( // notify user that they have been banned
          collection, {
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
            logger.log(`[${user}] has been restricted from [${restrictions.join(",")}] by [${admin}] until ${expiration}`);
            resolve(id);
          }
        );
        // resolve(id);
      }).catch((err) => { reject(err); }); // propogate error
    }).catch((err) => { reject(err); }); // propogate error
  });
}

function stringwiseAnd(arr1=[], arr2=[]) {
  const obj1 = {};
  const combinedArr = [];
  for (const el of arr1) { obj1[el] = true; } // put contents of array into dictionary
  for (const el of arr2) {
    if (obj1[el]) { // if element in dictionary, it exists in both arrays, and can be safely added
      combinedArr.push(el);
      delete obj1[el]; // prevent duplicates
    }
  }
  return combinedArr;
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
        api.update(
          collection, {
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
            else {
              logger.log(`[${transaction.data.ban}] has been unrestricted from [${transaction.data.restr.join(",")}] by [${transaction.parties[0]}]`);
              resolve(transaction.data.ban);
            }
          }
        )
      }).catch(err => { reject(err); });  
    }).catch((err) => { reject(err); });
  });
}

// returns true if banned
function updateBanStatus(bans) {
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
      if (numRemoved == bans.length) { resolve({}); } // all bans removed // no restrictions
      else {
        checkBanStatus(bans).then(restrictions => {
          resolve(restrictions);
        }).catch(err => { reject(err); });
      }
    }).catch((err) => {
      reject(err);
    });
  })
}

function checkBanStatus(bans) {
  return new Promise((resolve, reject) => {
    transactions.getTransactions(bans).then(docs => {
      const restrictions = {}; // restrictions on what permissions are temporarily unavailable to the user
      for (const doc of docs) {
        for (const restr of doc.data.restr) {
          restrictions[restr] = true;
        }
      }

      resolve(restrictions);
    }).catch(err => { reject(err); });
  })
}

exports.init = init;
exports.ban = ban;
exports.unban = unban;
exports.updateBanStatus = updateBanStatus;
exports.checkBanStatus = checkBanStatus;