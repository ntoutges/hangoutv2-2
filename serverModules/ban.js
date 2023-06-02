var collection;
var transactions;
var accounts;

function init(transactionsLib, accountsLib, accountCollection) {
  transactions = transactionsLib;
  accounts = accountsLib;
  collection = accountCollection;
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

function stringwiseAnd(arr1=[], arr2=[]) {
  const obj1 = {};
  const combinedArr = [];
  console.log(arr1, arr2)
  for (const el of arr1) { obj1[el] = true; } // put contents of array into dictionary
  console.log(obj1)
  for (const el of arr2) {
    if (obj1[el]) { // if element in dictionary, it exists in both arrays, and can be safely added
      console.log(el)
      combinedArr.push(el);
      delete obj1[el]; // prevent duplicates
    }
  }
  console.log(combinedArr)
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