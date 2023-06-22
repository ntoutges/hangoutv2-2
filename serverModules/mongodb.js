const { MongoClient, ServerApiVersion } = require("mongodb");

var client;

exports.init = function(uri) {
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  return new Promise(async (resolve,reject) => {
    try {
      console.log("Connecting to Mongo...")
      await client.connect();
      const db = await client.db("HangoutV2-2");
      exports.db = db;

      await db.command({ ping:1 });
      console.log("Successfully connected to MongoDB");
      resolve();
    }
    catch (err) {
      client.close();
      reject(err);
    }
  });
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
    .then((data) => { callback(null, data); })
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
  findSortSkipLimit,
  update,
  insert,
  remove
}