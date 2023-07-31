const { MongoClient, ServerApiVersion } = require("mongodb");

var client;
var logger;

exports.init = function(uri, dbName, lLogger) {
  logger = lLogger;
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  return new Promise(async (resolve,reject) => {
    try {
      logger.log("Connecting to Mongo...")
      await client.connect();
      const db = await client.db(dbName);
      exports.db = db;

      await db.command({ ping:1 });
      logger.log("Successfully connected to MongoDB");
      resolve();
    }
    catch (err) {
      client.close();
      reject(err);
    }
  });
}

exports.close = () => {
  return client.close();
}

function findOne(col, query, callback) {
  col.findOne(query)
    .then((data) => { callback(null, data); })
    .catch((err) => { callback(err, null); });
}

function find(col, query, callback) {
  col.find(query).toArray()
    .then((data) => { callback(null, data); })
    .catch((err) => { callback(err, null); });
}

function findWProjection(col, query, projection, callback) {
  col.find(query, callback).project(projection).toArray()
    .then(data => { callback(null, data); })
    .catch(err => { callback(err, null); });
}

function findSortSkipLimit(col, query, sort, skip, limit, callback) {
  col.find(query).sort(sort).skip(skip).limit(limit).toArray()
    .then((data) => { callback(null, data); })
    .catch((err) => { callback(err, null); });
}

function update(col, query, update, callback) {
  col.updateMany(query, update)
    .then((data) => { callback(null, data.modifiedCount); })
    .catch((err) => { callback(err, null); });
}

async function insert(col, doc, callback) {
  try {
    while (!("_id" in doc)) {
      let testId = generateId();
      await new Promise((resolve,reject) => {
        findOne(col, {"_id": testId}, (err, data) => {
          if (data) { resolve(); return; } // doc with id already exists
          if (err) { reject(err); return; } // error occured, drop everything
          
          // doc doesn't exist
          doc._id = testId;
          resolve();
        });
      });
    }
  }
  catch(err) {
    callback(err, null);
  }
  
  col.insertOne(doc)
    .then((data) => {
      callback(null, data["insertedId"]);
    })
    .catch((err) => { callback(err, null); });
}

function remove(col, query, callback) {
  col.deleteMany(query)
    .then((data) => { callback(null, data.deletedCount); })
    .catch((err) => { callback(err, null); });
}

const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function generateId(length=16) {
  let str = "";
  for (let i = 0; i < length; i++) { str += chars[Math.floor(Math.random() * chars.length)]; }
  return str;
}

exports.api = {
  findOne,
  find,
  findWProjection,
  findSortSkipLimit,
  update,
  insert,
  remove
}