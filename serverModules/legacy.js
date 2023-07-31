const nedbManager = require("./nedb.js");
const mongodbManager =  require("./mongodb.js");

var logger;
var config;
var queue = [];
var refQueue = {};

var dbManager;
var isLegacy;
exports.dbManager = dbManager;

exports.init = (lLogger, lConfig) => {
  logger = lLogger;
  config = lConfig;
}

async function connectCurrent() {
  if (!isLegacy && dbManager) return; // don't try to reconnect
  if (dbManager && config["database-type"] == "mongodb") { // disconnect previous user
    await dbManager.close();
    logger.log("Closed legacy");
  }
  isLegacy = false;

  if (config["database-type"] == "nedb") {
    dbManager = nedbManager;
    await dbManager.init(__dirname + "/db");
    dbManager.setAutocompactionInterval(172800000);
    
    const collections = config["db-collections"].split(",");
    for (const name of collections) {
      dbManager.addCollection(name);
    }
  }
  else if (config["database-type"] == "mongodb") {
    dbManager = mongodbManager;
    await mongodbManager.init(
      `mongodb+srv://${process.env.mongoUser}:${process.env.mongoPassword}@cluster0.ncf6vii.mongodb.net/?retryWrites=true&w=majority`,
      config["db-name"],
      logger
    );
  }
  else {
    throw new Error("Invalid database-type in config.jdon");
  }
  exports.dbManager = dbManager;
}

async function connectLegacy() {
  if (isLegacy && dbManager) return; // don't try to reconnect
  if (dbManager && config["database-type"] == "mongodb") { // disconnect previous user
    await dbManager.close();
    logger.log("Closed current");
  }
  isLegacy = true;

  if (config["legacy-database-type"] == "nedb") {
    dbManager = nedbManager;
    await dbManager.init(__dirname + "/db");
    dbManager.setAutocompactionInterval(172800000);
    
    const collections = config["legacy-collections"].split(",");
    for (const name of collections) {
      dbManager.addCollection(name);
    }
  }
  else if (config["legacy-database-type"] == "mongodb") {
    dbManager = mongodbManager;
    await mongodbManager.init(
      `mongodb+srv://${process.env.legacyMongoUser}:${process.env.legacyMongoPassword}@hangouts.85fyr.mongodb.net/?retryWrites=true&w=majority`,
      config["legacy-db"],
      logger
    );
  }
  else {
    throw new Error("Invalid database-type in config.jdon");
  }
  exports.dbManager = dbManager;
}

exports.connectCurrent = connectCurrent;
exports.connectLegacy = connectLegacy;

// exports.connectToLegacy = (
//   uri
// ) => {

// }

exports.fillQueue = (
  collectionName,
  batch=0,
  batchSize=50
) => {
  return new Promise((resolve,reject) => {
    const skip = batch * batchSize;
    dbManager.api.findSortSkipLimit(
      dbManager.db.collection(collectionName),
      {},
      {},
      skip,
      batchSize,
      (err, data) => {
        if (err) {
          throw new Error(err);
        }
        queue = queue.concat(data);
        resolve(queue);
      }
    );
  });
}

exports.fillReferenceQueue = (
  collectionName,
  projectId
) => {
  return new Promise((resolve,reject) => {
    dbManager.api.findWProjection(
      dbManager.db.collection(collectionName),
      {},
      {
        [projectId]: 1
      },
      (err, data) => {
        if (err) {
          throw new Error(err);
        }
        refQueue = {};
        data.forEach(doc => {
          refQueue[doc[projectId]] = true;
        })

        resolve(data);
      }
    );
  });
}

exports.emptyQueue = ( callback ) => {
  const promises = [];
  queue.forEach((document) => {
    promises.push(callback(document._id, document));
  });
  const length = queue.length;
  queue = [];
  return new Promise((resolve, reject) => {
    Promise.all(promises).then(() => {
      resolve(length);
      // resolve(0);
    }).catch(err => {
      logger.log(err);
      reject(err);
    })
  })
}
exports.inReferenceQueue = ( term ) => {
  return term in refQueue;
}
