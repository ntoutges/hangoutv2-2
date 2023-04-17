var collection;
var metadata;

function init(awardsCollection, metadataLib) {
  collection = awardsCollection;
  metadata = metadataLib;
}

function createAward(name, category, img, description="") {
  return new Promise((resolve,reject) => {
    collection.insert({
      name,
      category,
      "src": img,
      description
    }, (err,doc) => {
      if (!err) {
        reject(err);
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
        reject(err);
        return;
      }
      if (numUpdated != 1) {
        reject("Invalid id");
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
        reject(err);
        return;
      }
      if (!document) {
        reject("Invalid id");
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