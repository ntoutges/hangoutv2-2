var collection;
// var metadata;

function init(awardsCollection /*, metadataLib */) {
  collection = awardsCollection;
  // metadata = metadataLib;
}

function createAward(name, category, img, description="") {
  return new Promise((resolve,reject) => {
    collection.insert({
      name,
      category,
      "src": img,
      description
    }, (err,doc) => {
      if (err) {
        reject({
          "err": err.toString(),
          "code": 122,
          "type": "Error creating new award",
        });
        return;
      }
      resolve(doc);
    });
  });
}

function editAward(id, img, description) {
  return new Promise((resolve,reject) => {
    collection.update({
      "_id": id
    }, {
      $set: {
        "src": img,
        description
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
      resolve();
    });
  });
}

function getAward(id) {
  return new Promise((resolve,reject) => {
    collection.findOne({
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
    })
  });
}

function getAwards(category) {
  return new Promise((resolve,reject) => {
    
  });
}

exports.init = init;
exports.createAward = createAward;
exports.editAward = editAward;
exports.getAward = getAward;
exports.getAwards = getAwards;