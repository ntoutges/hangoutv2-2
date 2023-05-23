// only mildly deprecated (still deprecated)

var collection = null;
var dbManager = null;
var autosaveInterval = 100;
const cache = {};
const updates = {};
const timeouts = {};
const onInitListeners = [];

function init(metadataCollection, manager, autosaveInterval1=100) {
  return new Promise((resolve,reject) => {
    collection = metadataCollection;
    dbManager = manager;
    autosaveInterval = autosaveInterval1;

    const collections = dbManager.db.collections();
    for (const collection of collections) {
      cache[collection] = {};
      cache[collection] = [];
    }
    collection.find({
      "_id": {
        $in: collections
      }
    }, (err,documents) => {
      if (err) {
        reject(err);
        return;
      }
      for (const metadata of documents) {
        const col = metadata._id;
        delete metadata._id; // remove redundant [_id] property
        cache[col] = metadata;
      }
      resolve();
    });
  })
}

function set(document, property, value) {
  if (!(document in cache)) return false;
  if (cache[document][property] == value) return; // nothing needs to be done
  cache[document][property] = value;
  updates[document].push({
    "p": property,
    "v": value
  });
  
  if (autosaveInterval != 0) {
    if (timeouts[document]) clearTimeout(timeouts[document]);
    timeouts[document] = setTimeout(get.bind(this,document),autosaveInterval);
  }

  return true;
}

function get(document, property, defaultValue=undefined) {
  if (!(document in cache)) return defaultValue;
  return (property in cache[document]) ? cache[document][property] : defaultValue;
}

function save(document) {
  return new Promise((resolve,reject) =>{ 
    if (!(document) in updates) {
      reject("Invalid document");
      return;
    }
    if (timeouts[document]) { clearTimeout(timeouts[document]); }
    if (updates[document].length == 0) {
      resolve();
      updates[document] = [];
    }

    const updateData = {};
    for (const update of updates[document]) { updateData[update.p] = v; }

    collection.update({
      "_id": document
    }, {
      $set: updateData
    }, (err,data) => {
      if (err) {
        reject(err);
        return;
      }
      updates[document] = [];
      resolve();
    });
  });
}

function onInit(func) {
  onInitListeners.push();
}

exports.init = init;
exports.set = set;
exports.get = get;
exports.save = save;