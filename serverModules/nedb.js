const Datastore = require('nedb');
const { nedbExt } = require(__dirname + "/neDB_ext.js");

const db = new nedbExt(Datastore);

var ROOT_DIR = null;
var autocompactionInterval = 172800000;

function init(root) {
  ROOT_DIR = root;
  return new Promise((resolve, reject) => {
    try {
      db.init(resolve);
    }
    catch(err) {
      reject({
        "err": err.toString(),
        "code": 134,
        "type": `Error when initializing local NeDB database`,
      });
    }
  });
}

function addCollection(name, ext="txt") {
  if (ROOT_DIR == null) throw new Error("ROOT directory not yet established; call init(<root>)");
  db.addCollection(name, `${ROOT_DIR}/${name}.${ext}`);
}

function setAutocompactionInterval(interval=172800000) {
  autocompactionInterval = interval;
  for (let collection of db.collections()) {
    db.collection(collection).persistence.setAutocompactionInterval(autocompactionInterval);
  }
}

exports.db = db;
exports.init = init;
exports.addCollection = addCollection;
exports.setAutocompactionInterval = setAutocompactionInterval;


function findOne(col, query, callback) { col.findOne(query, callback); }
function find(col, query, callback) { col.find(query, callback); }
function findSortSkipLimit(col, query, sort, skip, limit, callback) {
  col.find(query).sort(sort).skip(skip).limit(limit).exec(callback);
}
function update(col, query, update, callback) { col.update(query, update, callback); }
function insert(col, doc, callback) { col.insert(doc, (err,data) => { callback(err, data._id); }); }
function remove(col, query, callback) { col.remove(query, {}, callback); }

// exports.findOne = findOne;
// exports.find = find;
// exports.findSortSkipLimit = findSortSkipLimit;
// exports.insert = insert;
// exports.remove = remove;

exports.api = {
  findOne,
  find,
  findSortSkipLimit,
  update,
  insert,
  remove
}