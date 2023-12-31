const Datastore = require('nedb');
const { nedbExt } = require(__dirname + "/neDB_ext.js");

const db = new nedbExt(Datastore);

var ROOT_DIR = null;
var autocompactionInterval = 172800000;

function init(root) {
  ROOT_DIR = root;
  return new Promise((res, rej) => {
    try {
      db.init(res);
    }
    catch(err) {
      rej(err);
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