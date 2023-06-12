var collection = null;
var api;

function init(col, dbAPI) {
  collection = col;
  api = dbAPI;
}

function createTransaction(parties, data, type) {
  return new Promise((res, rej) => {
    api.insert(
      collection, {
        "parties": parties,
        "data": data,
        "type": type,
        "init": (new Date()).getTime()
      }, (err,transactionId) => {
        if (err) {
          rej({
            "err": err.toString(),
            "code": 160,
            "type": "Error creating new transaction"
          });
        }
        else res(transactionId);
      }
    )
  });
}

function getTransaction(transactionId) {
  return new Promise((res,rej) => {
    api.findOne(
      collection, {
        "_id": transactionId
      }, (err,transaction) => {
        if (err) {
          rej({
            "err": err.toString(),
            "code": 161,
            "type": `Error when finding transaction with id ${transactionId}`
          });
        }
        else if (!transaction) {
          rej({
            "err": "Transaction does not exist",
            "code": -162,
            "type": `unable to find transaction with id [${transactionId}]`
          });
        }
        else res(transaction);
      });
    }
  );
}

function getTransactions(transactionIds) {
  return new Promise((res,rej) => {
    api.find(
      collection, {
        "_id": {
          $in: transactionIds
        }
      }, (err,transactions) => {
        if (err) {
          rej({
            "err": err.toString(),
            "code": 163,
            "type": `Error when finding transactions with ids ${JSON.stringify(transactionIds)}`
          });
        }
        else res(transactions);
      }
    );
  });
}

function resolveTransaction(transactionId, returnDoc=false) {
  return new Promise((res,rej) => {
    if (returnDoc) {
      api.findOne(
        collection, {
          "_id": transactionId
        }, (err, document) => {
          if (err) {
            rej({
              "err": err.toString(),
              "code": 164,
              "type": `Error when resolving transaction with id ${transactionId}`
            });
            return;
          }
          if (!document) {
            rej({
              "err": "Transaction does not exist",
              "code": -165,
              "type": `unable to find transaction with id ${transactionId}`
            });
            return;
          }
  
          api.remove(
            collection, {
              "_id": transactionId
            }, (err, numRemoved) => {
              if (err) {
                rej({
                  "err": err.toString(),
                  "code": 166,
                  "type": `Error when deleting transaction with id ${transactionId}`
                });
              }
              else if (numRemoved == 0) {
                rej({
                  "err": "Transaction does not exist",
                  "code": -167,
                  "type": `unable to delete transaction with id ${transactionId}`
                });
              }
              else res(document);
            }
          );
        }
      );
    }
    else {
      api.remove(
        collection, {
          "_id": transactionId
        }, (err, numRemoved) => {
          if (err) {
            rej({
              "err": err.toString(),
              "code": 168,
              "type": `Error when deleting transaction with id ${transactionId}`
            });
          }
          else if (numRemoved == 0) {
            rej({
              "err": "Transaction does not exist",
              "code": 169,
              "type": `unable to delete transaction with id ${transactionId}`
            });
          }
          else res();
        }
      );
    }
  });
}

function resolveTransactionsConditional(filterCondition, type=null) {
  return new Promise((resolve,reject) => {
    if (type) filterCondition.type = type;
    api.remove(
      collection,
      filterCondition,
      (err, numRemoved) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 158,
            "type": `Error resolving transaction given conditions: ${JSON.stringify(filterCondition)}`
          });
        }
        else resolve(numRemoved);
      }
    );
  });
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

    resolveTransactionsConditional( removeFilter ).then((numRemoved) => {
      resolve(numRemoved);
    }).catch(err => { reject(err); });
    // collection.remove(removeFilter, {}, (err, numRemoved) => {
    //   if (err) {
    //     reject({
    //       "err": err.toString(),
    //       "code": 159,
    //       "type": `Error resolving transaction given conditions: ${JSON.stringify(filterCondition)}`
    //     });
    //   }
    //   resolve(numRemoved);
    // })
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