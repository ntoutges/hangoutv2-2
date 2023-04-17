var collection = null;
function init(col) {
  collection = col;
}

function createTransaction(parties, data, type) {
  return new Promise((res, rej) => {
    collection.insert({
      "parties": parties,
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

function resolveTransaction(transactionId, returnDoc=false) {
  return new Promise((res,rej) => {
    if (returnDoc) {
      collection.findOne({
        "_id": transactionId
      }, (err, document) => {
        if (err) {
          rej(err);
          return;
        }
        if (!document) {
          rej(`Transaction ${transactionId} does not exist`);
          return;
        }

        collection.remove({
          "_id": transactionId
        }, {}, (err, numRemoved) => {
          if (err) rej(err);
          else if (numRemoved == 0) rej(`Transaction ${transactionId} does not exist`);
          else res(document);
        });
      });
    }
    else {
      collection.remove({
        "_id": transactionId
      }, {}, (err, numRemoved) => {
        if (err) rej(err);
        else if (numRemoved == 0) rej(`Transaction ${transactionId} does not exist`);
        else res();
      });
    }
  });
}

function resolveTransactionsConditional(filterCondition, type) {
  return new Promise((resolve,reject) => {
    filterCondition.type = type;
    collection.remove(filterCondition, {}, (err, numRemoved) => {
      if (err) reject(err);
      else resolve(numRemoved);
    })
  })
}

function resolveOldTransactions(maxAge, types=[]) {
  return new Promise((resolve,reject) => {
    const minSafeTime = (new Date()).getTime() - maxAge;
    const removeFilter = {
      "init": {
        $lt: minSafeTime
      }
    };
    if (types.length != 0) { // without elements in types, there is not restriction to what is resolved
      removeFilter.type = {
        $in: types
      };
    }
    collection.remove(removeFilter, {}, (err, numRemoved) => {
      if (err) reject(err);
      resolve(numRemoved);
    })
  })
}

exports.collection = collection;
exports.init = init;
exports.createTransaction = createTransaction;
exports.getTransaction = getTransaction;
exports.getTransactions = getTransactions;
exports.resolveTransaction = resolveTransaction;
exports.resolveTransactionsConditional = resolveTransactionsConditional;
exports.resolveOldTransactions = resolveOldTransactions;