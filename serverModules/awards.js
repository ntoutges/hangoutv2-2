var collection;
var documents;
var api;

function init(awardsCollection, docsLib, dbAPI) {
  collection = awardsCollection;
  documents = docsLib;
  api = dbAPI;
}

function createAward(name, category, docId, description="") {
  return new Promise((resolve,reject) => {
    const WHEN_DONE = 2;

    documents.useDocument(docId).then(() => {
      api.insert({
        name,
        category,
        "src": docId,
        description
      }, (err,newDocId) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 122,
            "type": "Error creating new award",
          });
          return;
        }
        resolve(newDocId);
      });
    }).catch(err => { reject(err); });
  });
}

function editAward(id, docId, description) {
  return new Promise((resolve,reject) => {
    api.findOne(
      collection, {
        "_id": id
      }, (err, doc) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 174,
            "type": `Error searching for award with id [${id}]`
          });
          return;
        }
        if (!doc) {
          reject({
            "err": "Invalid id",
            "code": -175,
            "type": `Document with id [${id}] could not be found`
          });
          return;
        }
  
        const oldDoc = doc.src;
        if (oldDoc == docId) { // nothing actually needs to be done
          resolve();
          return;
        }
  
        const WHEN_DONE = 3;
        let done_counter = 0;
  
        documents.useDocument(docId).then(() => {
          if (++done_counter == WHEN_DONE) { resolve(); }
        }).catch(err => { reject(err); });
        documents.deleteDocument(oldDoc).then(() => {
          if (++done_counter == WHEN_DONE) { resolve(); }
        }).catch(err => { reject(err); });
      }
    );

    api.update(
      collection, {
        "_id": id
      }, {
        $set: {
          "src": docId,
          "description": description
        }
      }, (err,numUpdated) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 123,
            "type": `Error editing award with id [${id}]`,
          });
          return;
        }
        if (numUpdated != 1) {
          reject({
            "err": "Award does not exist",
            "code": -124,
            "type": `award with id [${id}] does not exist`,
          });
          return;
        }
  
        if (++done_counter == WHEN_DONE) { resolve(); }
      }
    );
  });
}

function getAward(id) {
  return new Promise((resolve,reject) => {
    api.findOne(
      collection, {
        "_id": id
      }, (err,document) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 125,
            "type": `Error trying to access award with id [${id}]`,
          });
          return;
        }
        if (!document) {
          reject({
            "err": "Award does not exist",
            "code": -126,
            "type": `Award with id [${id}] does not exist`,
          });
          return;
        }
        resolve(document);
      }
    );
  });
}

function getAwards(category) {
  return new Promise((resolve,reject) => {
    api.find(
      collection, {
        "category": category
      }, (err,awards) => {
        if (awards) {
          reject({
            "err": err.toString(),
            "code": 181,
            "type": `Error trying to access award with id [${id}]`,
          });
          return;
        }
        resolve(awards);
      }
    );
  });
}

exports.init = init;
exports.createAward = createAward;
exports.editAward = editAward;
exports.getAward = getAward;
exports.getAwards = getAwards;