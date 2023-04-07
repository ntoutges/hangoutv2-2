var collection = null;
function init(col) {
  collection = col;
}

function createTransaction(userA, userB, data, type) {
  return new Promise((res, rej) => {
    collection.insert({
      "parties": [
        userA,
        userB
      ],
      "data": data,
      "type": type,
      "init": (new Date()).getTime()
    }, (err,transaction) => {
      if (err) rej(err);
      else res(transaction._id);
    });
  });
}

function getTransaction(transactionId) {
  return new Promise((res,rej) => {
    collection.findOne({
      "_id": transactionId
    }, (err,transaction) => {
      if (err) rej(err);
      else if (!transaction) rej(`Transaction ${transactionId} does not exist`);
      else res(transaction);
    });
  });
}

function getTransactions(transactionIds) {
  return new Promise((res,rej) => {
    collection.find({
      "_id": {
        $in: transactionIds
      }
    }, (err,transactions) => {
      if (err) rej(err);
      else res(transactions);
    });
  });
}

function resolveTransaction(transactionId) {
  return new Promise((res,rej) => {
    collection.remove({
      "_id": transactionId
    }, {}, (err, numRemoved) => {
      if (err) rej(err);
      else if (numRemoved == 0) rej(`Transaction ${transactionId} does not exist`);
      else res();
    });
  });
}

exports.collection = collection
exports.init = init;
exports.createTransaction = createTransaction;
exports.getTransaction = getTransaction;
exports.getTransactions = getTransactions;
exports.resolveTransaction = resolveTransaction;