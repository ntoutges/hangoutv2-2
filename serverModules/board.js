// HYPER deprecated

var db = null;
exports.init = function(database) {
  db = database;
}

function createBoardNote(noteData, domain="main") {
  return new Promise((resolve) => {
    db.collection("board").insert({
      noteData,
      domain: domain
    }, (err, document) => {
      resolve({err, document});
    });
  });
}

function updateBoardNote(noteData, id, user) {
  return new Promise((resolve) => {
    modifiable(id,user).then((value) => {
      if (value.err)
        resolve(value.err);
      else
        db.collection("board").update({ // perform actual update of document
          "_id": id
        }, {
          $set: {
            noteData
          }
        }, {}, (err) => {
          resolve({err});
        });
    })
  });
}

function removeBoardNote(id, user) {
  return new Promise((resolve) => {
    modifiable(id,user).then((value) => {
      if (value.err)
        resolve(value.err);
      else
        db.collection("board").remove({
          "_id": id
        }, (err, data) => {
          resolve({err});
        });
    });
  });
}

function modifiable(id, user) {
  return new Promise((resolve) => {
    db.collection("board").findOne({ // ensure that only owner is updating document
      "_id": id
    }, (err, document) => {
      if (err)
        resolve({err});
      else if (!document)
        resolve({err: "Document does not exist"});
      else if (!document.noteData || !document.noteData.u)
        resolve({err: "Invalid document"});
      else if (document.noteData.u != user)
        resolve({err: "403"});
      else
        resolve({});
    });
  })
}

function removeOldMessages(ageLimit, domain="main") {
  const now = new Date().getTime();
  const oldest = now - ageLimit;
  console.log(db.collection("board").remove)
  return new Promise((resolve) => {
    db.collection("board").remove({
      "domain": domain,
      "noteData.c": {
        $lt: oldest
      }
    }, {
      "multi": true
    }, (err, data) => {
      resolve({err});
    });
  });
}

exports.createBoardNote = createBoardNote;
exports.updateBoardNote = updateBoardNote;
exports.removeBoardNote = removeBoardNote;
exports.modifiable = modifiable;
exports.removeOldMessages = removeOldMessages;