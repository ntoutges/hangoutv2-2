var transactions = null;
var collection = null;

function init(transactionsLib, friendsCollection) {
  transactions = transactionsLib;
  collection = friendsCollection;
}

function accept(transactionId, userId) {
  return updateFriends(
    transactionId,
    userId,
    [
      ["$pull", "friends.requested", transactionId],
      ["$push", "friends.confirmed", "%f"]
    ]
  )
}

function reject(transactionId, userId) {
  return updateFriends(
    transactionId,
    userId,
    [
      ["$pull", "friends.requested", transactionId]
    ]
  )
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
        if (err) reject(err);
        else reject("Invalid userId");
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
        if (err) reject(err);
        else reject("Invalid friendId");
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
    collection.findOne({
      "_id": userId
    }, (err,userData) => {
      // make sure user is not already friends with [friendId]
      if (err) {
        reject(err);
        return;
      }
      if (!userData) {
        reject("Invalid userId");
        return;
      }
      else if (("friends" in userData) && ("confirmed" in userData.friends) && userData.friends.confirmed.includes(friendId)) {
        reject("Already friends");
        return;
      }
      // make transaction to link [userId] and [friendId]
      transactions.createTransaction(
        userId,
        friendId,
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
        ).then(() => resolve).catch(reject);
      }).catch(reject);
    });
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
        reject("Invalid transaction type");
        return;
      }

      const fromUser = transaction.data.from;
      const toUser = transaction.parties[(fromUser == transaction.parties[0]) ? 1 : 0]; // other user

      const friendId = (userId == fromUser) ? toUser : fromUser; // make friendId the user that is not current user

      const fromReplaceData = {
        "%a": fromUser,
        "%b": toUser,
        "%u": userId,
        "%f": friendId
      };
      const toReplaceData = {
        "%a": fromUser,
        "%b": toUser,
        "%u": friendId,
        "%f": userId
      };

      const fromUserData = {};
      const toUserData = {};
      for (const path of updateDataConstruction) {
        let fromUserHead = fromUserData;
        let toUserHead = toUserData;
        for (let i = 0; i < path.length-1; i++) {
          // different so as to swap [userId] and [friendId] terms
          const fromUserInstruction = replaceInstructions( path[i], fromReplaceData );
          const toUserInstruction = replaceInstructions( path[i], toReplaceData );

          if (i == path.length-2) { // finish constructing datas
            fromUserHead[fromUserInstruction] = replaceInstructions( path[i+1], fromReplaceData );
            toUserHead[fromUserInstruction] = replaceInstructions( path[i+1], toReplaceData );
          }
          else {
            fromUserHead[fromUserInstruction] = {};
            toUserHead[toUserInstruction] = {};
            fromUserHead = fromUserHead[fromUserInstruction];
            toUserHead = toUserHead[toUserInstruction];
          }
        }
      }
      
      let didError = false;
      let activeProcesses = 2 + resolveTransaction;
      collection.update({
        "_id": fromUser
      }, fromUserData, (err, numUpdated) => {
        if (err || numUpdated == 0) {
          if (didError) return; // don't call reject more than once
          if (err) reject(err);
          else reject("Invalid transaction data");
          didError = true;
        }
        activeProcesses--;
        if (activeProcesses == 0) resolve();
      });
      collection.update({
        "_id": toUser
      }, toUserData, (err, numUpdated) => {
        if (err || numUpdated == 0) {
          if (didError) return; // don't call reject more than once
          if (err) reject(err);
          else reject("Invalid transaction data");
          didError = true;
        }
        activeProcesses--;
        if (activeProcesses == 0) resolve();
      });
      if (resolveTransaction) {
        transactions.resolveTransaction(transactionId).then(() => {
          activeProcesses--;
          if (activeProcesses == 0) resolve();
        }).catch(reject);
      }
    }).catch(err => {
      reject(err);
    });
  });
}

function replaceInstructions(str, data) {
  for (let i in data) {
    str = str.replace(new RegExp(i, "g"), data[i]);
  }
  return str;
}

exports.init = init;
exports.accept = accept;
exports.reject = reject;
exports.remove = remove;
exports.request = request;
