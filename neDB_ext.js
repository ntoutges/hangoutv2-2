exports.nedbExt = class nedbExt { // technically a *custom* module
  constructor(Datastore) {
    this.__collections = {}; // store as hash list
    this.__buffer = {};
    
    this.Datastore = Datastore;
    this.callback = function() {};
    this.__initialized = false;
  }
  addCollection(name, path) {
    let db = new this.Datastore({ filename: path });
    this.__collections[name] = db;
    this.__buffer[name] = true;
    db.loadDatabase((err) => {
      this.checkCallback(name);
    });
  }
  checkCallback(name) {
    if (this.__initialized)
      return;
    if (name in this.__buffer)
      delete this.__buffer[name];
    if (Object.keys(this.__buffer).length == 0) {
      this.callback();
      this.__initialized = true;
    }
  }
  collection(col) { // get, just in standard db.collection.x format
    if (!col in this.__collections) { return null; }
    return this.__collections[col];
  }
  collections() {
    let cols = [];
    for (let i in this.__collections) { cols.push(i); }
    return cols;
  }
  init(callback) {
    this.callback = callback;
    this.checkCallback(null);
  }
}
