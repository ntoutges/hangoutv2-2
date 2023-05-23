var transactions = null;
var collection = null;

function init(transactionsLib, friendsCollection) {
  transactions = transactionsLib;
  collection = friendsCollection;
}

function accept(transactionId, userId) {
  return new Promise((resolve,reject) => {
    // make sure user cannot accept their own request
    transactions.getTransaction(transactionId).then(transaction => {
      if (transaction.type != "friendRequest") {
        reject({
          "err": "Invalid Transaction Type",
          "code": 135,
          "type": `Transaction with id [${id}] is not of type \"friendRequest\"`
        });
        return;
      }
      if (transaction.data.from == userId) { // user is trying to accept their own request (that they sent)
        reject({
          "err": "User cannot accept their own request",
          "code": 136,
          "type": "Friend request must be accepted by other user"
        });
        return;
      }
      
      updateFriends(
        transactionId,
        userId,
        [
          ["$pull", "friends.requested", transactionId],
          ["$push", "friends.confirmed", "%f"]
        ]
      ).then(resolve).catch(err => { reject(err); });
    }).catch(err => { reject(err); });
  })
}

function reject(transactionId, userId) {
  return updateFriends(
    transactionId,
    userId,
    [
      ["$pull", "friends.requested", transactionId]
    ]
  );
}

function remove(userId, friendId) {
  return new Promise((resolve,reject) => {
    let activeProcesses = 2;
    let didError = false;
    collection.update({
      "_id": userId
    }, {
      $pull: {
        "friends.confirmed": friendId
      }
    }, (err, numUpdated) => {
      if (err || numUpdated == 0) {
        if (didError) return; // don't call reject more than once
        if (err) {
          reject({
            "err": err.toString(),
            "code": 137,
            "type": `Error updating user [${userId}]`
          });
        }
        else { // numUpdated = 0
          reject({
            "err": "Invalid user id",
            "code": -138,
            "type": `Error updating user [${userId}]`
          });
        }
        didError = true;
      }
      activeProcesses--;
      if (activeProcesses == 0) resolve();
    });
    collection.update({
      "_id": friendId
    }, {
      $pull: {
        "friends.confirmed": userId
      }
    }, (err, numUpdated) => {
      if (err || numUpdated == 0) {
        if (didError) return; // don't call reject more than once
        if (err) {
          reject({
            "err": err.toString(),
            "code": 139,
            "type": `Error updating user [${friendId}]`
          });
        }
        else { // numUpdated = 0
          reject({
            "err": "Invalid user id",
            "code": -140,
            "type": `Error updating user [${friendId}]`
          });
        }
        didError = true;
      }
      activeProcesses--;
      if (activeProcesses == 0) resolve();
    });
  })
}

// builds a transaction representing this request
function request(userId, friendId) {
  return new Promise((resolve,reject) => {
    getFriendStatus(userId, friendId).then((relation) => {
      // make sure users are not already friends
      if (relation != "unrelated") { // already friends/request already sent
        reject({
          "err": "Users already related",
          "code": -141,
          "type": `[${userId}] and [${friendId}] are already \"${relation}\"`
        });
        return;
      }

      // make transaction to link [userId] and [friendId]
      transactions.createTransaction(
        [
          userId,
          friendId
        ],
        {
          "from": userId
        },
        "friendRequest"
      ).then((transactionId) => {
        updateFriends(
          transactionId,
          userId,
          [
            ["$push", "friends.requested", transactionId]
          ],
          false
        ).then(() => resolve(transactionId)).catch(reject);
      }).catch(reject);
    }).catch(reject);
  });
}

// %a = replace with requester
// %b = replace with requestee
// %u = replace with current user id
// %f = replace with current friend (other party than current user id)
function updateFriends(transactionId, userId, updateDataConstruction, resolveTransaction=true) {
  return new Promise((resolve,reject) => {
    transactions.getTransaction(transactionId).then(transaction => {
      if (transaction.type != "friendRequest") {
        reject({
          "err": "Invalid Transaction Type",
          "code": 142,
          "type": `Transaction with id [${transactionId} is not of type \"friendRequest\"]`
        });
        return;
      }

      const fromUser = transaction.data.from;
      const toUser = transaction.parties[(fromUser == transaction.parties[0]) ? 1 : 0]; // other user

      const friendId = (userId == fromUser) ? toUser : fromUser; // make friendId the user that is not current user

      const userReplaceData = {
        "%a": fromUser,
        "%b": toUser,
        "%u": userId,
        "%f": friendId
      };
      const friendReplaceData = {
        "%a": fromUser,
        "%b": toUser,
        "%u": friendId,
        "%f": userId
      };

      const userUserInstruction = {};
      const friendUserInstruction = {};
      for (const path of updateDataConstruction) {
        let userUserHead = userUserInstruction;
        let friendUserHead = friendUserInstruction;
        for (let i = 0; i < path.length-1; i++) {
          // different so as to swap [userId] and [friendId] terms
          const userUserInstruction = replaceInstructions( path[i], userReplaceData );
          const friendUserInstruction = replaceInstructions( path[i], friendReplaceData );

          if (i == path.length-2) { // finish constructing datas
            userUserHead[userUserInstruction] = replaceInstructions( path[i+1], userReplaceData );
            friendUserHead[friendUserInstruction] = replaceInstructions( path[i+1], friendReplaceData );
          }
          else {
            userUserHead[userUserInstruction] = {};
            friendUserHead[friendUserInstruction] = {};
            userUserHead = userUserHead[userUserInstruction];
            friendUserHead = friendUserHead[friendUserInstruction];
          }
        }
      }
      
      let didError = false;
      let activeProcesses = 2 + resolveTransaction;
      collection.update({
        "_id": userId
      }, userUserInstruction, (err, numUpdated) => {
        if (err || numUpdated == 0) {
          if (didError) return; // don't call reject more than once
          if (err) {
            reject({
              "err": err.toString(),
              "code": 143,
              "type": `Error trying to update user id [${userId}]`
            });
          }
          else { // numUpdated = 0
            reject({
              "err": "Invalid User Id",
              "code": -144,
              "type": `unable to update user [${id}]`
            });
          }
          didError = true;
        }
        activeProcesses--;
        if (activeProcesses == 0) resolve(friendId);
      });
      collection.update({
        "_id": friendId
      }, friendUserInstruction, (err, numUpdated) => {
        if (err || numUpdated == 0) {
          if (didError) return; // don't call reject more than once
          if (err) {
            reject({
              "err": err.toString(),
              "code": 145,
              "type": `Error trying to update user id [${friendId}]`
            });
          }
          else { // numUpdated = 0
            reject({
              "err": "Invalid User Id",
              "code": -146,
              "type": `unable to update user [${friendId}]`
            });
          }
          didError = true;
        }
        activeProcesses--;
        if (activeProcesses == 0) resolve(friendId);
      });
      if (resolveTransaction) {
        transactions.resolveTransaction(transactionId).then(() => {
          activeProcesses--;
          if (activeProcesses == 0) resolve(friendId);
        }).catch((err) => { reject(err) });
      }
    }).catch(err => { reject(err); });
  });
}

function replaceInstructions(str, data) {
  for (let i in data) {
    str = str.replace(new RegExp(i, "g"), data[i]);
  }
  return str;
}

// can return "friends" | "requested" | "unrelated"
function getFriendStatus(userA, userB) {
  return new Promise((res,rej) => {
    collection.findOne({
      "_id": userA
    }, (err,userData) => {
      if (err) rej(err);
      else if (!userData) rej("Invalid user id");
      else if ("friends" in userData && "confirmed" in userData.friends && userData.friends.confirmed.includes(userB)) res("friends");
      else if ("friends" in userData && "requested" in userData.friends) { // userData.friends.requested => transactionIds
        transactions.getTransactions(userData.friends.requested).then((transactions) => {
          for (const transaction of transactions) {
            if (transaction.parties.includes(userB)) { // request has been sent, but not yet confirmed
              res("requested");
              return;
            }
          }
          res("unrelated");
        }).catch(rej);
      }
      else res("unrelated");
    });
  });
}

exports.init = init;
exports.accept = accept;
exports.reject = reject;
exports.remove = remove;
exports.request = request;
exports.getFriendStatus = getFriendStatus;