const { genId } = require("./uniqueId");

var collection;
var jimp;
var fs;
var saveFolderLocation;


exports.init = function init(documentsCollection, jimpLib, fsLib, saveFolder) {
  collection = documentsCollection;
  jimp = jimpLib;
  fs = fsLib;
  saveFolderLocation = saveFolder;
}

function createDocument(oldpath, filetype) {
  return new Promise((resolve, reject) => {
    const docId = genId("docs");
    const newpath = `${saveFolderLocation}/public/${docId}.${filetype}`;

    const docData = { // autogenerated _id will provide the name of the file
      "uses": 1,
      "main": { // main file to point to
        path: newpath,
        ext: filetype
      },
      "alts": [] // to be used in extensions, such as pictures with different LODs
    };

    collection.insert(docData, (err, newDoc) => {
      if (err) {
        reject({
          "err": err.toString(),
          "code": 100,
          "type": "Error creating new doc-document"
        });
        return;
      }

      fs.rename(oldpath, newpath, err => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 101,
            "type": "Error moving file from staging to public file"
          });
          return;
        }

        resolve(newDoc);
      });
    });
  });
}

function createImageDocument(oldpath, filetype, maxW=256, maxH=256) {
  return new Promise((resolve, reject) => {
    jimp.read(oldpath).then(img => {
      const w = img.bitmap.width;
      const h = img.bitmap.height;

      let width = Math.min(w, maxW); // w * maxW / w  =  maxW
      let height = h * width / w; // start with conversion based on width
      if (height > maxH) {
        height = Math.min(h, maxH); // h * maxH / h  =  maxH
        width = w * height / h; // change conversion to be based on height
      }

      const newoldpath = `${saveFolderLocation}/staging/${genId("docs")}.${filetype}`;
      img.resize(width, height).writeAsync(newoldpath).then(() => { // create new temp file storing resized image
        createDocument(newoldpath, filetype).then((newDoc) => {
          
          fs.unlink(oldpath, (err) => { // delete original temp file
            if (err) {
              reject({
                "err": err.toString(),
                "code": 102,
                "type": "Error removing original upload file"
              });
              return;
            }
            resolve(newDoc);
          });

        }).catch(err => { reject(err); }); // propogate
      }).catch(err => {
        reject({
          "err": err.toString(),
          "code": 103,
          "type": "Error resizing image"
        });
      });
    }).catch(err => {
      reject({
        "err": err.toString(),
        "code": 104,
        "type": "Error reading image file"
      });
    });
  });
}

function useDocument(id) {
  return new Promise((resolve, reject) => {
    collection.update({
      "_id": id
    }, {
      $inc: {
        "uses": 1
      }
    }, {}, (err, updatedCount) => {
      if (err) {
        reject({
          "err": err.toString(),
          "code": 172,
          "type": "Error updating use counter"
        });
        return;
      }

      if (updatedCount == 0) {
        reject({
          "err": "Document does not exist",
          "code": -172,
          "type": `document with id [${id}] does not exist`
        });
        return;
      }

      resolve();
    });
  });
}

function deleteDocument(id) {
  return new Promise((resolve, reject) => {
    collection.findOne({
      "_id": id
    }, (err, doc) => {
      if (err) {
        reject({
          "err": err.toString(),
          "code": 105, // negative error code indicates non-blocking err
          "type": `Error trying to read document _id: [${id}]`,
        });
        return;
      }
      if (!doc) {
        reject({
          "err": "Document does not exist",
          "code": -106, // negative error code indicates non-blocking err
          "type": `document with _id [${id}] does not exist`,
        });
        return;
      }

      const WHEN_FINISHED = 2;
      let finishedCounter = 0;

      if (doc.uses == 1) {
        collection.remove({
          "_id": id
        }, {}, (err, numRemoved) => {
          if (err) {
            reject({
              "err": err.toString(),
              "code": 107,
              "type": `Error trying to delete document _id: [${id}]`,
            });
            return;
          }
          if (numRemoved != 1) {
            reject({
              "err": "Failed to remove document",
              "code": -108,
              "type": `no documents exist with _id [${id}]`,
            });
            return;
          }

          if (++finishedCounter == WHEN_FINISHED) {
            resolve();
          }
        });

        fs.unlink(doc.main.path, (err) => {
          if (err) {
            reject({
              "err": err.toString(),
              "code": 109,
              "type": `Error deleting ${doc.main.path}`,
            });
            return;
          }

          if (++finishedCounter == WHEN_FINISHED) {
            resolve();
          }
        });
      }
      else {
        collection.update({
          "_id": id
        }, {
          $set: {
            "uses": doc.uses - 1
          }
        }, {}, (err,updatedCount) => {
          if (err) {
            reject({
              "err": err.toString(),
              "code": 110,
              "type": `Error updating [uses] on document with _id: [${id}]`,
            });
            return;
          }
          if (updatedCount != 1) {
            reject({
              "err": "Unable to update document",
              "code": -111,
              "type": `no documents exist with _id: [${id}]`,
            });
            return;
          }
          resolve(doc.uses-1);
        });
      }
    });
  });
}

function getMainFileURI(id) {
  return new Promise((resolve, reject) => {
    collection.findOne({
      "_id": id
    }, (err, doc) => {
      if (err) {
        reject({
          "err": err.toString(),
          "code": 112,
          "type": `Error finding document with id [${id}]`,
        });
        return;
      }
      if (!doc) {
        reject({
          "err": "Document does not exist",
          "code": -113,
          "type": `document with id [${id}] does not exist`,
        });
        return;
      }

      resolve(doc.main.path);
    });
  });
}

function getMainFileURIs(ids) {
  return new Promise((resolve, reject) => {
    collection.find({
      "_id": {
        $in: ids
      }
    }, (err, docs) => {
      if (err) {
        reject({
          "err": err.toString(),
          "code": 170,
          "type": "Error finding documents",
        });
        return;
      }

      const data = {};
      for (const doc of docs) { data[doc._id] = doc.main.path; }

      resolve(data);
    });
  });
}

exports.createDocument = createDocument;
exports.createImageDocument = createImageDocument;
exports.useDocument = useDocument;
exports.deleteDocument = deleteDocument;
exports.getMainFileURI = getMainFileURI;
exports.getMainFileURIs = getMainFileURIs;