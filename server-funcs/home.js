//@ts-check

var gDbManager;
var gSockets;
var gDocuments;
var gFriends;
var gConfig;
var gFormidable

exports.init = ({
  dbManager,
  sockets,
  documents,
  friends,
  config,
  formidable
}) => {
  gDbManager = dbManager;
  gSockets = sockets;
  gDocuments = documents;
  gFriends = friends;
  gConfig = config;
  gFormidable = formidable;
}

exports.getHome = (req,res) => {
  let userId;
  if ("user" in req.query) userId = req.query.user;
  else if (req.session.user) userId = req.session.user;
  else {
    res.redirect("/");
    return;
  }

  gDbManager.api.findOne(
    gDbManager.db.collection("accounts"), {
      "_id": userId
    }, (err,doc) => {
      if (err || !doc) {
        res.send("An error occured");
      }
      else {
        gSockets.moveToRoom(req.sessionID, `home-${userId}`);
        res.render("pages/home.ejs", {
          title: "Home",
          isLoggedIn: !!req.session.user,
          isSidebar: true,
          permissions: req.session.perms ?? {},
          name: doc.name,
          bio: doc.bio ?? "",
          id: req.sessionID,
          accountId: req.session.user,
          viewingAccountId: userId,
          homeJS: (userId == req.session.user) ? "home.js" : "homeView.js"
        });
      }
    }
  );
}

exports.postUpdateBio = (req,res) => {
  if (!req.session.user) {
    res.send(false);
    return;
  }

  const MAX_BIO_LENGTH = 500;

  let bio = (req.body.bio ?? "").toString().substring(0, MAX_BIO_LENGTH); // bio must ALWAYS be a string // limit bio to 500 characters
  gDbManager.api.update(
    gDbManager.db.collection("accounts"), {
      "name": req.session.name
    }, {
      $set: {
        "bio": bio
      }
    }, (err, updatedCount) => {
      if (err || updatedCount != 1)
        res.send(false);
      else {
        res.send(true);
        gSockets.emitToRoom("updateBio", bio, `home-${req.session.user}`);
      }
    }
  );
}

exports.getProfile = (req,res) => {
  const id = req.query.id ?? null;
  if (id == null) {
    res.send({});
    return;
  }

  gDbManager.api.findOne(
    gDbManager.db.collection("accounts"), {
      "_id": id
    }, (err,data) => {
      if (err || !data) { res.send({}); }
      else {
        data.pass = "";
        res.send(data);
      }
    }
  );
}

exports.postRequestFriend = (req,res) => {
  // don't know who to modify if not logged in
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }
  // missing essential data
  if (!("friend" in req.body)) {
    res.send("Missing transaction id");
    return;
  }
  
  gFriends.request(req.session.user, req.body.friend).then((transactionId) => {
    res.sendStatus(200);
    gSockets.emitToRoom(
      "requestFriend",
      {
        from: req.session.user,
        to: req.body.friend,
        transaction: { /* this is enough data for updating the user */
          _id: transactionId,
          data: {
            from: req.session.user
          }
        }
      },
      `home-${req.body.friend}`);
  }).catch((err) => {
    console.log(err)
    res.sendStatus(500);
  });
}

exports.postRemoveFriend = (req,res) => {
  // don't know who to modify if not logged in
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }
  // missing essential data
  if (!("friend" in req.body)) {
    res.send("Missing transaction id");
    return;
  }
  
  gFriends.remove(req.session.user, req.body.friend).then(() => {
    res.send("success");
    
    gSockets.emitToRoom("removeFriend", req.session.friend, `home-${req.session.user}`);
    gSockets.emitToRoom("removeFriend", req.session.user, `home-${req.body.friend}`);
  }).catch((err) => {
    console.log(err)
    res.send(err);
  });
}

exports.postChangeFriendsRequest = (req,res) => {
  // don't know who to modify if not logged in
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }
  // missing essential data
  if (!("action" in req.body)) {
    res.send("Missing action to perform");
  }
  
  if (!("transaction" in req.body)) {
    res.send("Missing transaction id");
    return;
  }
  let functionToCall;
  switch (req.body.action) {
    case "accept":
      functionToCall = gFriends.accept;
      break;
    case "reject":
      functionToCall = gFriends.reject;
      break;
    default:
      res.sendStatus(400);
      return;
  }
  functionToCall(req.body.transaction, req.session.user).then((friendId) => {
    res.send("success");
    
    const socketData = {
      from: friendId,
      to: req.session.user,
      action: req.body.action
    };
    gSockets.emitToRoom("changeFriendsRequest", socketData, `home-${req.session.user}` );
    gSockets.emitToRoom("changeFriendsRequest", socketData, `home-${friendId}` );
  }).catch((err) => {
    res.send(err);
  });
}

exports.getTransactions = (req,res) => {
  if (!("transactions" in req.query)) {
    res.sendStatus(400);
    return;
  }
  const transactions = req.query.transactions.split(",");

  gDbManager.api.find(
    gDbManager.db.collection("transactions"), {
      _id: {
        $in: transactions
      }
    }, (err,docs) => {
      if (err) res.sendStatus(500);
      else res.send(docs);
    }
  );
}

exports.getUserRelations = (req,res) => {
  if (!("userA" in req.query) || !("userB" in req.query)) {
    res.sendStatus(400);
    return;
  }
  gFriends.getFriendStatus(req.query.userA, req.query.userB).then((relation) => {
    
    res.send(relation);
  }).catch((err) => {
    console.log(err)
    res.sendStatus(400)
  });
}

exports.getGetProfilePicture = (req,res) => {
  let user = req.session.user;
  if ("user" in req.query) {
    user = req.query.user;
  }
  
  if (!user) {
    res.send("Missing user");
    return;
  }

  gDbManager.api.findOne(
    gDbManager.db.collection("accounts"), {
      "_id": user
    }, (err,document) => {
      if (err) {
        console.log(err);
        res.send("err");
        return;
      }
      if (!document) {
        res.send("Invalid user");
        return;
      }
      
      if ("picture" in document) {
        gDocuments.getMainFileURI(document.picture).then((uri) => {
          res.sendFile(uri);
        }).catch(err => {
          console.log(err);
          res.sendFile(__dirname + + "/" + gConfig["default-profile-picture"]);
        })
      }
      else {
        res.sendFile(__dirname + "/" + gConfig["default-profile-picture"]);
      }
    }
  );
}

exports.postSetProfilePicture = (req,res) => {
  if (!req.session.user || !("upload" in req.session.perms)) {
    res.sendStatus(403);
    return;
  }

  const form = gFormidable({
    multiples: false,
    maxFileSize: 26214400, // set max file size for images in bytes (25 x 1024 x 1024) // 25 MB
    uploadDir: __dirname + "/documents/staging"
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.log(err);
      res.send(err.type);
      return;
    }

    if (!files.file) {
      console.log("no file"); // do something here
      res.send("Must upload a file");
      return;
    }

    const fileType = gDocuments.fileIsValid(files.file);
    if (fileType) {
      gDbManager.api.findOne(
        gDbManager.db.collection("accounts"), {
          "_id": req.session.user
        }, async (err,userDoc) => {
          if (err) {
            console.log(err);
            console.log(err)
            res.send(err.type);
            return;
          }
          if (!userDoc) {
            res.send("Invalid user");
            return;
          }
  
          // delete if will cause duplicates
          if (userDoc.picture) {
            try {
              await gDocuments.deleteDocument(userDoc.picture);
            }
            catch(err) {
              console.log(err);
              if (err.code > 0) { // codes less than 0 are non-essential errors
                res.send(err.type);
                return;
              }
            }
          }
  
          console.log(files.file.path)
          gDocuments.createImageDocument(files.file.path, fileType).then(docId => {
            gDbManager.api.update(
              gDbManager.db.collection("accounts"), {
                "_id": req.session.user
              }, {
                $set: {
                  "picture": docId
                }
              }, (err,numUpdated) => {
                if (err) {
                  console.log(err);
                  res.send(err.type);
                  return;
                }
                if (numUpdated == 0) {
                  res.send("Invalid user");
                  return;
                }
        
                res.redirect("/home");
              }
            );
          }).catch(err => {
            console.log(err);
            res.send(err.type);
          });
        }
      );
    }
    else {
      res.send("Invalid file");
    }
  });
}

exports.postSelectProfilePicture = (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }

  if (!("id" in req.body)) {
    res.send("Missing document id");
    return;
  }
  const id = req.body.id;
  
  gDbManager.api.findOne(
    gDbManager.db.collection("accounts"), {
      "_id": req.session.user
    }, async (err,userDoc) => {
      if (err) {
        console.log(err);
        res.send(err.type);
        return;
      }
      if (!userDoc) {
        res.send("Invalid user");
        return;
      }

      gDocuments.useDocument(id).then(async () => {
        // delete if will cause duplicates
        if (userDoc.picture) {
          try {
            await gDocuments.deleteDocument(userDoc.picture);
          }
          catch(err) {
            console.log(err);
            if (err.code > 0) { // codes less than 0 are non-essential errors
              res.send(err.type);
              return;
            }
          }
        }

        gDbManager.api.update(
          gDbManager.db.collection("accounts"), {
            "_id": req.session.user
          }, {
            $set: {
              "picture": id
            }
          }, (err,numUpdated) => {
            if (err) {
              console.log(err);
              res.send(err.type);
              return;
            }
            if (numUpdated == 0) {
              res.send("Invalid user");
              return;
            }
  
            res.send("");
          }
        );
      }).catch(err => {
        if (err.code > 0) { // less than 0 is non-critical
          console.log(err);
        }
        res.send(err.type);
      });
    }
  );
}