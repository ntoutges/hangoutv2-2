const express = require('express');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const formidable = require('formidable');
const socketio = require('socket.io');
const jimp = require("jimp");
const fs = require('fs');
const JDON = require("./serverModules/jdon.js");

const board = require("./serverModules/board.js");

require('dotenv').config(); // give access to .env file

const nedbManager = require("./serverModules/nedb.js");
const mongodbManager = require("./serverModules/mongodb.js");
const sockets = require("./serverModules/socketManager.js");
const friends = require("./serverModules/friends.js");
const transactions = require("./serverModules/transactions.js");
const accounts = require("./serverModules/accounts.js");
const ban = require("./serverModules/ban.js");
const awards = require("./serverModules/awards.js")
const ratings = require("./serverModules/ratings.js");
const documents = require("./serverModules/documents.js");

const app = express();
const http = require("http").Server(app);
app.set('view engine', 'ejs');
app.use(expressLayouts);

// app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())

app.use( session({
  secret: process.env.secret,
  resave: false,
  saveUninitialized: false
}) );

const SALTING_ROUNDS = 10;
var config;

config = JDON.toJSON(
  fs.readFileSync(
    __dirname + "/config.jdon",
    {
      "encoding": "utf8",
      "flag": "r"
    }
  ),
);

var dbManagerInit;
var dbManager;
if (config["database-type"] == "nedb") {
  dbManager = nedbManager;
  dbManagerInit = dbManager.init(__dirname + "/db");
  dbManager.setAutocompactionInterval(172800000);
  dbManager.addCollection("accounts");
  dbManager.addCollection("posts");
  dbManager.addCollection("channels");
  dbManager.addCollection("transactions");
  dbManager.addCollection("awards");
  dbManager.addCollection("ratings");
  dbManager.addCollection("documents");
}
else if (config["database-type"] == "mongodb") {
  dbManager = mongodbManager;
  dbManagerInit = mongodbManager.init(
    `mongodb+srv://mrcode123:${process.env.mongoPassword}@cluster0.ncf6vii.mongodb.net/?retryWrites=true&w=majority`
  );
}
else {
  throw new Error("Invalid database-type in config.jdon");
}

dbManagerInit.then(() => {
  // board.init(dbManager.db);
  sockets.init(http);
  friends.init(transactions, dbManager.db.collection("accounts"), dbManager.api);
  transactions.init(dbManager.db.collection("transactions"), dbManager.api);
  accounts.init(dbManager.db.collection("accounts"), dbManager.api);
  ban.init(transactions, accounts, dbManager.db.collection("accounts"), dbManager.api);
  awards.init(dbManager.db.collection("awards"), documents, dbManager.api);
  ratings.init(dbManager.db.collection("posts"), dbManager.db.collection("ratings"), dbManager.api);
  documents.init(dbManager.db.collection("documents"), jimp, fs, __dirname, "documents", dbManager.api);
  http.listen(process.env.PORT || 52975, () => {
    getPhotoRollContents();
    console.log("app started");
  });
}).catch(err => {
  console.log(err);
});

var photoRollContents = [];
function getPhotoRollContents() {
  fs.readdir(__dirname + "/photo-roll/", {}, (err, files) => {
    if (err) { console.log(err); }
    else { photoRollContents = files; }
  });
}

/* __________________
  /                  \
  | jmp SIGN IN CODE |
  \__________________/
*/

app.get("/", (req,res) => {
  if (req.session.name) {
    res.redirect("/home");
    return;
  }
  
  let firstPhoto = (photoRollContents.length > 0) ? photoRollContents[Math.floor(Math.random()*photoRollContents.length)] : ""; // need to decide what to do if PhotoRolLContents is empty
  res.render("pages/signIn.ejs", {
    title: "Sign In",
    isLoggedIn: false,
    isSidebar: false,
    permissions: req.session.perms,
    promoPhotoSrc: firstPhoto,
    id: null,
    accountId: null
  });
});

app.post("/signIn", (req,res) => {
  if (!("user" in req.body)) { // no username sent
    res.send("Invalid");
    return;
  }
  if (!("pass" in req.body) || req.body.pass.length == 0) { // no password sent
    res.send("Invalid");
    return;
  }
  doSignIn(req.body.user, req.body.pass, req,res);
});

function doSignIn(username, password, req,res) {
  accounts.verifyAccountIdentity(username, password).then((userDoc) => {
    ban.checkBanStatus(userDoc.bans).then((restrictions) => { // these are permissions that have been taken away, aka restrictions
      if ("login" in restrictions) {
        res.send("Temp-Banned");
      }
      else {
        const sessionValues = accounts.getSessionValues(userDoc);
        if (!("login" in sessionValues.perms)) { // user is essentially permanently banned from even logging in
          res.send("Perm-Banned");
          return;
        }
        
        for (const key in sessionValues) {
          req.session[key] = sessionValues[key];
        }
        accounts.addSession(username, req.session, req.sessionID);
        res.send("Valid");
      }
    }).catch(err => {
      console.log(err);
      res.send(err.type);
    });
  }).catch((err) => {
    console.log(err)
    if (err.code < 0) res.send("Invalid"); // non-critical error = incorrect credentials
    else res.send(err.type);
  });
}

/* __________________
  /                  \
  | jmp SIGN UP CODE |
  \__________________/
*/
// this also known as   | jmp sponsor code |

app.get("/signUp", (req,res) => {
  // if (req.session.name) {
  //   res.redirect("/home");
  //   return;
  // }

  if (!req.session.user || !("sponsor" in req.session.perms)) {
    res.redirect("/");
    return;
  }

  let firstPhoto = (photoRollContents.length > 0) ? photoRollContents[Math.floor(Math.random()*photoRollContents.length)] : ""; // need to decide what to do if PhotoRolLContents is empty
  res.render("pages/signUp.ejs", {
    title: "Sign Up",
    isLoggedIn: true,
    isSidebar: true,
    permissions: req.session.perms,
    promoPhotoSrc: firstPhoto,
    id: req.sessionID,
    accountId: req.session.user
  });
});

app.post("/createAccount", (req,res) => {
  // lacks requisite permissions
  if (!req.session.user || !("sponsor" in req.session.perms)) {
    res.send("perms");
    return;
  }

  if (!("user" in req.body)) { // no username sent
    res.send("user");
    return;
  }
  if (!("pass" in req.body) || req.body.pass.length == 0) { // no password sent
    res.send("pass");
    return;
  }
  let username = req.body.user;
  let password = req.body.pass;
  
  accounts.createAccount(
    username,
    password,
    req.session.user,
    SALTING_ROUNDS
  ).then(() => {
    res.send("Valid")
    // doSignIn(username, password, req,res);
  }).catch(err => {
    if (err == "user already exists") res.send("username");
    else res.sendStatus(500);
  });
});

app.get("/sponsored", (req,res) => {
  // not allowed to see (or unable to sponsor) accounts
  if (!req.session.user || !("sponsor" in req.session.perms)) {
    res.send("perms");
    return;
  }

  dbManager.api.find(
    dbManager.db.collection("accounts"), {
      "sponsor": req.session.user
    }, (err,docs) => {
      if (err) {
        res.send("error");
        console.log(err);
        return;
      }
      res.send(docs);
    }
  );
});

app.post("/addPermission", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403); // not signed in
    return;
  }
  if (!("id" in req.body)) {
    res.send("Missing id");
    return;
  }
  if (!("perm" in req.body)) {
    res.send("Missing permission");
    return;
  }
  const id = req.body.id;
  const perm = req.body.perm;

  accounts.getAccount(req.session.user).then(userDoc => {
    const permissions = userDoc.perms ?? [];
    if (permissions.indexOf(perm) == -1) {
      res.send("Invalid permission");
      return;
    }
    accounts.addPermission(id, perm).then(() => {
      res.send("ok");
    }).catch(err => {
      console.log(err);
      res.send("error");
    });
    
  }).catch(err => {
    console.log(err);
    res.send("error");
  });
});

app.post("/removePermission", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403); // not signed in
    return;
  }
  if (!("id" in req.body)) {
    res.send("Missing id");
    return;
  }
  if (!("perm" in req.body)) {
    res.send("Missing permission");
    return;
  }
  const id = req.body.id;
  const perm = req.body.perm;

  accounts.getAccount(id).then(userDoc => {
    const permissions = userDoc.perms ?? [];
    if (permissions.indexOf(perm) == -1) {
      res.send("Invalid permission");
      return;
    }
    accounts.removePermission(id, perm).then(() => {
      res.send("ok");
    }).catch(err => {
      console.log(err);
      res.send("error");
    });
    
  }).catch(err => {
    console.log(err);
    res.send("error");
  });
});

app.post("/banPermission", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403); // not signed in
    return;
  }
  if (!("id" in req.body)) {
    res.send("Missing id");
    return;
  }
  if (!("perm" in req.body)) {
    res.send("Missing permission");
    return;
  }
  if (!("expiration" in req.body)) {
    res.send("Missing expiration");
    return;
  }
  
  const id = req.body.id;
  const perm = req.body.perm;
  const expiration = req.body.expiration;

  accounts.getAccount(id).then(userDoc => {
    const permissions = userDoc.perms ?? [];
    if (permissions.indexOf(perm) == -1) {
      res.send("Invalid permission");
      return;
    }
    // accounts.removePermission(id, perm).then(() => {
    //   res.send("ok");
    // }).catch(err => {
    //   console.log(err);
    //   res.send("error");
    // });
    ban.ban( id, req.session.user, expiration, [perm]).then(id => {
      res.send("ok");
      return;
    }).catch(err => {
      console.log(err);
      res.send("error");
    });
    
  }).catch(err => {
    console.log(err);
    res.send("error");
  });
});

app.post("/unbanPermission", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403); // not signed in
    return;
  }
  if (!("banId" in req.body)) {
    res.send("Missing banId");
    return;
  }
  
  const id = req.body.banId;
  transactions.getTransaction(id).then(doc => { // make sure person doing unbanning is also the one who banned permission initially
    const banner = doc.parties[0];
    if (!banner) {
      res.send("error");
      console.log("no parties");
      return;
    }
    if (banner != req.session.user) {
      res.send("invalid permissions");
      return;
    }

    ban.unban(id).then(() => {
      res.send("ok");
    }).catch(err => {
      console.log(err);
      res.send("error");
    })
  }).catch(err => {
    console.log(err);
    // res.send("error");
  })
});


/* ___________________
  /                   \
  | jmp SIGN OUT CODE |
  \___________________/
*/

app.get("/signOut", (req,res) => {
  res.redirect("/");
  doLogout(req.session);
});

function doLogout(session) {
  accounts.removeSession(session.user, session);
  session.destroy();
}

/* _______________
  /               \
  | jmp HOME CODE |
  \_______________/
*/

app.get("/home", (req,res) => {
  let userId;
  if ("user" in req.query) userId = req.query.user;
  else if (req.session.user) userId = req.session.user;
  else {
    res.redirect("/");
    return;
  }

  dbManager.api.findOne(
    dbManager.db.collection("accounts"), {
      "_id": userId
    }, (err,doc) => {
      if (err || !doc) {
        res.send("An error occured");
      }
      else {
        sockets.moveToRoom(req.sessionID, `home-${userId}`);
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
});

app.post("/updateBio", (req,res) => {
  if (!req.session.user) {
    res.send(false);
    return;
  }

  const MAX_BIO_LENGTH = 500;

  let bio = (req.body.bio ?? "").toString().substring(0, MAX_BIO_LENGTH); // bio must ALWAYS be a string // limit bio to 500 characters
  dbManager.api.update(
    dbManager.db.collection("accounts"), {
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
        sockets.emitToRoom("updateBio", bio, `home-${req.session.user}`);
      }
    }
  );
});

app.get("/profile", (req,res) => {
  const id = req.query.id ?? null;
  if (id == null) {
    res.send({});
    return;
  }

  dbManager.api.findOne(
    dbManager.db.collection("accounts"), {
      "_id": id
    }, (err,data) => {
      if (err || !data) { res.send({}); }
      else {
        data.pass = "";
        res.send(data);
      }
    }
  );
});

app.post("/requestFriend", (req,res) => {
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
  
  friends.request(req.session.user, req.body.friend).then((transactionId) => {
    res.sendStatus(200);
    sockets.emitToRoom(
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
});

app.post("/removeFriend", (req,res) => {
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
  
  friends.remove(req.session.user, req.body.friend).then(() => {
    res.send("success");
    
    sockets.emitToRoom("removeFriend", req.session.friend, `home-${req.session.user}`);
    sockets.emitToRoom("removeFriend", req.session.user, `home-${req.body.friend}`);
  }).catch((err) => {
    console.log(err)
    res.send(err);
  });
});

app.post("/changeFriendsRequest", (req,res) => {
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
      functionToCall = friends.accept;
      break;
    case "reject":
      functionToCall = friends.reject;
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
    sockets.emitToRoom("changeFriendsRequest", socketData, `home-${req.session.user}` );
    sockets.emitToRoom("changeFriendsRequest", socketData, `home-${friendId}` );
  }).catch((err) => {
    res.send(err);
  });
});

app.get("/transactions", (req,res) => {
  if (!("transactions" in req.query)) {
    res.sendStatus(400);
    return;
  }
  const transactions = req.query.transactions.split(",");

  dbManager.api.find(
    dbManager.db.collection("transactions"), {
      _id: {
        $in: transactions
      }
    }, (err,docs) => {
      if (err) res.sendStatus(500);
      else res.send(docs);
    }
  );
});

app.get("/userRelations", (req,res) => {
  if (!("userA" in req.query) || !("userB" in req.query)) {
    res.sendStatus(400);
    return;
  }
  friends.getFriendStatus(req.query.userA, req.query.userB).then((relation) => {
    
    res.send(relation);
  }).catch((err) => {
    console.log(err)
    res.sendStatus(400)
  });
});

app.get("/getProfilePicture", (req,res) => {
  let user = req.session.user;
  if ("user" in req.query) {
    user = req.query.user;
  }
  
  if (!user) {
    res.send("Missing user");
    return;
  }

  dbManager.api.findOne(
    dbManager.db.collection("accounts"), {
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
        documents.getMainFileURI(document.picture).then((uri) => {
          res.sendFile(uri);
        }).catch(err => {
          console.log(err);
          res.sendFile(__dirname + + "/" + config["default-profile-picture"]);
        })
      }
      else {
        res.sendFile(__dirname + "/" + config["default-profile-picture"]);
      }
    }
  );
});

app.post("/setProfilePicture", (req,res) => {
  if (!req.session.user || !("upload" in req.session.perms)) {
    res.sendStatus(403);
    return;
  }

  const form = formidable({
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

    }

    const fileType = documents.fileIsValid(files.file);
    if (fileType) {
      dbManager.api.findOne(
        dbManager.db.collection("accounts"), {
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
  
          // delete if will cause duplicates
          if (userDoc.picture) {
            try {
              await documents.deleteDocument(userDoc.picture);
            }
            catch(err) {
              console.log(err);
              if (err.code > 0) { // codes less than 0 are non-essential errors
                res.send(err.type);
                return;
              }
            }
          }
  
          documents.createImageDocument(files.file.path, fileType).then(docId => {
            dbManager.api.update(
              dbManager.db.collection("accounts"), {
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
});

app.post("/selectProfilePicture", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }

  if (!("id" in req.body)) {
    res.send("Missing document id");
    return;
  }
  const id = req.body.id;
  
  dbManager.api.findOne(
    dbManager.db.collection("accounts"), {
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

      documents.useDocument(id).then(async () => {
        // delete if will cause duplicates
        if (userDoc.picture) {
          try {
            await documents.deleteDocument(userDoc.picture);
          }
          catch(err) {
            console.log(err);
            if (err.code > 0) { // codes less than 0 are non-essential errors
              res.send(err.type);
              return;
            }
          }
        }

        dbManager.api.update(
          dbManager.db.collection("accounts"), {
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
    });
});

/* ________________
  /                \
  | jmp POSTS CODE |
  \________________/
*/

app.get("/posts", (req,res) => {
  console
  res.render("pages/posts.ejs", {
    title: "Posts",
    isLoggedIn: !!req.session.user,
    isSidebar: true,
    permissions: req.session.perms ?? {},
    user: req.session.user,
    id: req.sessionID,
    accountId: req.session.user,
  });
  let channel = req.query.channel ?? "main";
  sockets.moveToRoom(req.sessionID, `posts-${channel}`);
});

app.post("/createPost", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }

  if (!("title" in req.body)) {
    res.send({"msg":"Bad Title"});
    return;
  }
  if (!("content" in req.body)) {
    res.send({"msg":"Bad Content"});
    return;
  }

  // remove trailing white space
  const title = req.body.title.replace(/\s+$/g, "");
  const content = req.body.content.replace(/\s+$/g, "");
  const channel = ("channel" in req.body) ? (req.body.channel.trim()) : "main";

  if (title.trim().length == 0 || title.length > 200) {
    res.send({"msg":"Bad Title"});
    return;
  }
  if (content.trim().length == 0 || content.length > 4000) {
    res.send({"msg":"Bad Content"});
    return;
  }

  dbManager.api.findOne(
    dbManager.db.collection("channels"), {
      "_id": channel
    }, (err, channelData) => {
      if (err) { // something bad happened...
        res.sendStatus(500);
        return;
      }
      if (!channelData) { // the channel does not exist
        res.sendStatus(404);
        return;
      }
      const document = {
        "title": title,
        "content": content,
        "published": (new Date()).getTime(),
        "user": req.session.user,
        "channel": channel
      }
    
      dbManager.api.insert(
        dbManager.db.collection("posts"),
        document,
        (err, finalDocId) => {
          if (err) {
            res.sendStatus(500);
            return;
          }
          res.send({"msg":"Valid", "body":document});
          sockets.emitToRoom("newDocs", finalDocId, `posts-${channel}`);
    
          dbManager.api.update(
            dbManager.db.collection("channels"), {
              "_id": channel
            }, {
              $push: {
                "posts": finalDocId
              },
              $set: {
                "activity": document.published
              }
            }, (err) => {
              if (err) console.log("ERROR:", err);
            }
          );
        }
      );
    }
  );
});

app.get("/getPosts", (req,res) => {
  const index = parseInt(req.query.index ?? 0);
  const limit = parseInt(req.query.limit || 10);
  const channel = req.query.channel ?? "main";

  dbManager.api.findSortSkipLimit(
    dbManager.db.collection("posts"),
    { channel },
    { "published": -1 },
    index,
    limit,
    (err, docs) => {
      if (err) res.sendStatus(500);
      res.send(docs);
    }
  );
});

app.get("/getPost", (req,res) => {
  const id = req.query.id ?? null;
  if (id == null) {
    res.send({});
    return;
  }

  dbManager.api.findOne(
    dbManager.db.collection("posts"), {
      "_id": id
    }, (err, data) => {
      if (err) {
        res.send({});
        return;
      }
      res.send(data);
    }
  );
});

app.post("/ratePost", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }

  if (!("rating" in req.body)) {
    res.send("Missing rating");
    return;
  }
  const rating = req.body.rating;

  if (!("id" in req.body)) {
    res.send("Missing message id");
    return;
  }
  const id = req.body.id;

  ratings.saveRating(id, rating, req.session.user).then(([newRating, channel]) => {
    const socketData = {
      "rating": newRating,
      "id": id
    };
    sockets.emitToRoom(
      "rating",
      JSON.stringify(socketData),
      `posts-${channel}`
    );
    res.send(true);
  }).catch(err => {
    res.send(err.toString());
  })
});

app.get("/ratedPosts", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }

  if (!("postIds" in req.query)) {
    res.send("Missing postIds");
    return;
  }
  if (typeof req.query.postIds != "string") {
    res.send("Invalid postIds");
    return;
  }

  ratings.hasRated(
    req.session.user,
    req.query.postIds.split(",")
  ).then((ids) => {
    res.send(ids);
  }).catch(err => {
    res.send(false);
  });
});


/* _____________________
  /                     \
  | jmp PHOTO ROLL CODE |
  \_____________________/
*/

app.get("/getPhotoRoll", (req,res) => {
  res.send(photoRollContents);
});

app.get("/getPhoto/*", (req,res) => {
  let pathname = req._parsedOriginalUrl.pathname;
  let photoRequested = pathname.replace("/getPhoto/", "").replace(/[\\,/]/g, ""); // take out any slashes that could lead to exploits
  photoRequested = photoRequested.replace(/%20/g, " "); // unescape space characters in the name
  res.sendFile(__dirname + "/photo-roll/" + photoRequested);
});

/* ______________
  /              \
  | jmp BAN CODE |
  \______________/
*/

app.get("/ban", (req,res) => {
  if (!req.session.user || !("ban" in req.session.perms)) {
    res.redirect("/");
    return;
  }

  res.render("pages/ban.ejs", {
    title: "Ban",
    isLoggedIn: true,
    isSidebar: true,
    permissions: req.session.perms ?? {},
    id: req.sessionID,
    accountId: req.session.user,
  });
});

app.post("/banUser", (req,res) => {
  if (!req.session.user || !("ban" in req.session.perms)) {
    res.sendStatus(403); // not an admin
    return;
  }
  if (!("user" in req.body)) {
    res.send("Missing user to ban");
    return;
  }
  let types = ["login"]; // default
  if ("types" in req.body) {
    types = req.body.types.split(",");
  } 

  const user = req.body.user;
  const duration = req.body.duration ?? 86400000; // stored in ms // default of 1 day

  ban.ban(user, req.session.user, (new Date()).getTime() + duration, types).then(banId => {
    accounts.getSessions(user).forEach(({ session, id }) => {
      sockets.emitTo(id, "ban", true);
      doLogout(session);
    });
    res.send({ id: banId });
  }).catch(err => {
    console.log(err)
    res.send({ err });
  });
});

app.post("/unbanUser", (req,res) => {
  if (!req.session.user || !("ban" in req.session.perms)) {
    res.sendStatus(403); // not an admin
    return;
  }
  if (!("banId" in req.body)) {
    res.send("Missing banId to unban");
    return;
  }

  ban.unban(req.body.banId).then((user) => {
    // shouldn't really be logged in, so this would be useless
    // accounts.getSessions(user).forEach((session) => {
    //   sockets.emitTo(session.id, "ban", false);
    // });
    res.send({});
  }).catch(err => {
    res.send({ err });
  });
});

app.get("/banStatus", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }
  if (!("banId" in req.query)) {
    res.send("Missing id");
    return;
  }
  
  accounts.getAccount(req.session.user).then(doc => {
    if (doc.perms.indexOf(req.query.banId) != -1 || ("login" in req.session.perms)) {
      ban.checkBanStatus([req.query.banId]).then(restrictions => {
        res.send(Object.keys(restrictions).join(","));
      }).catch(err => { res.send(err.toString()); });
    }
    else { res.sendStatus(403); }
  }).catch(err => {
    console.log(err);
    res.send(err.toString());
  });
});

app.get("/bans", (req,res) => {
  if (!("ids" in req.query)) {
    res.send("Missing ids");
    return;
  }
  // if (!Array.isArray(req.query.ids)) {
  //   res.send("Invalid ids");
  //   return;
  // }

  const ids = req.query.ids.split(",");
  ban.checkBanStatus(ids).then(restrictions => {
    res.send(restrictions);
  }).catch(err => {
    console.log(err);
    res.send({});
  });
});

app.get("/banInfo", (req,res) => {
  if (!("id" in req.query)) {
    res.send("Missing id");
    return;
  }

  accounts.getAccount(req.query.id).then(doc => {
    const bans = doc.bans ?? [];
    ban.checkBanStatus(bans).then(restrictions => {
      res.send(Object.keys(restrictions).join(","));
    }).catch(err => { res.send(err.toString()); });
  }).catch(err => {
    console.log(err);
    res.send(err.toString());
  });
});


/* ________________
  /                \
  | jmp AWARD CODE |
  \________________/
*/

app.get("/award", (req,res) => {
  if (!req.session.user || !("award" in req.session.perms)) {
    res.redirect("/");
    return;
  }
  res.render("pages/award.ejs", {
    title: "Award",
    isLoggedIn: true,
    isSidebar: true,
    permissions: req.session.perms,
    id: req.sessionID,
    accountId: req.session.user
  });
});

app.get("/awards", (req,res) => {
  if (!("awards" in req.query)) {
    res.send([]); // don't need to check database to know there is no data
    return;
  }
  if (typeof req.query.awards != "string") {
    res.sendStatus(400); // user error -- wrong data type
    return;
  }

  const awards = req.query.awards.split(",");

  dbManager.api.find(
    dbManager.db.collection("awards"), {
      _id: {
        $in: awards
      }
    }, (err,docs) => {
      if (err) res.sendStatus(500);
      else res.send(docs);
    }
  );
});

app.get("/allAwards", (req,res) => {
  dbManager.api.find(
    dbManager.db.collection("awards"), {},
    (err,docs) => {
      if (err) res.sendStatus(500);
      else res.send(docs);
    }
  );
});

app.post("/giveAward", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }
  if (!("award" in req.session.perms)) {
    res.sendStatus(403);
    return;
  }
  if (!("user" in req.body)) {
    res.send("Missing user id");
    return;
  }
  if (!("award" in req.body)) {
    res.send("Missing award id");
    return;
  }

  dbManager.api.update(
    dbManager.db.collection("accounts"), {
      "_id": req.body.user
    }, {
      $addToSet: {
        "awards": req.body.award
      }
    }, (err, numUpdated) => {
      if (err) {
        res.sendStatus(500);
        return;
      }
      if (numUpdated == 0) {
        res.send("User doesn't exist");
        return;
      }
      res.send("Valid");
    }
  );
});

app.post("/removeAward", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }
  if (!("award" in req.session.perms)) {
    res.sendStatus(403);
    return;
  }
  if (!("user" in req.body)) {
    res.send("Missing user id");
    return;
  }
  if (!("award" in req.body)) {
    res.send("Missing award id");
    return;
  }

  dbManager.api.update(
    dbManager.db.collection("accounts"), {
      "_id": req.body.user
    }, {
      $pull: {
        "awards": req.body.award
      }
    }, (err, numUpdated) => {
      if (err) {
        res.sendStatus(500);
        return;
      }
      if (numUpdated == 0) {
        res.send("User doesn't exist");
        return;
      }
      res.send("Valid");
    }
  );
});

/* _______________
  /               \
  | jmp DOCS CODE |
  \_______________/
*/

app.get("/document", (req,res) => {
  if (!("id" in req.query)) {
    res.sendFile(__dirname + "/public/graphics/missing.png");
    return;
  }
  const id = req.query.id;

  documents.getMainFileURI(id).then(data => {
    res.sendFile(data);
  }).catch(err => {
    if (err > 0) console.log(err); // don't worry about trivial problems, like "Document does not exist"
    res.sendFile(__dirname + "/public/graphics/missing.png");
  });
});


/* _______________
  /               \
  | jmp TEMP CODE |
  \_______________/
*/





app.use( express.static(__dirname + '/public') ); // at the end to prevent 404 errors