const Datastore = require('nedb');
const m = require(__dirname + "/neDB_ext.js");

export const db = new nedbExt(Datastore);

var ROOT_DIR = null;
var autocompactionInterval = 172800000;

export function init(root) {
  ROOT_DIR = root;
  return new Promise((res, rej) => {
    try {
      db.init(() => {
        res;
      });
    }
    catch(err) {
      rej(err);
    }
  });
}

export function addCollection(name, ext="txt") {
  if (ROOT_DIR == null) throw new Error("ROOT directory not yet established; call init(<root>)");
  db.addCollection(name, `${ROOT_DIR}/${name}.${ext}`);
}

export function setAutocompactionInterval(interval=172800000) {
  autocompactionInterval = interval;
  for (let collection in db.collections()) {
    db.collection(collection).persistence.setAutocompactionInterval(autocompactionInterval);
  }
}
