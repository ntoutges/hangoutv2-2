const express = require('express');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const formidable = require('formidable');
const imageMagick = require('node-imagemagick');
const socketio = require('socket.io');
const fs = require('fs');

const board = require("./serverModules/board.js");

require('dotenv').config(); // give access to .env file

const dbManager = require("./serverModules/db.js");
const sockets = require("./serverModules/socketManager.js");
const friends = require("./serverModules/friends.js");
const transactions = require("./serverModules/transactions.js");
const accounts = require("./serverModules/accounts.js");
const ban = require("./serverModules/ban.js");
const awards = require("./serverModules/awards.js")
// const metadata = require("./serverModules/metadata.js");
const ratings = require("./serverModules/ratings.js");

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

dbManager.init(__dirname + "/db").then(() => {
  board.init(dbManager.db);
  sockets.init(http);
  friends.init(transactions, dbManager.db.collection("accounts"));
  transactions.init(dbManager.db.collection("transactions"));
  accounts.init(dbManager.db.collection("accounts"));
  ban.init(transactions, accounts, dbManager.db.collection("accounts"));
  awards.init(dbManager.db.collection("awards") /*, metadata */);
  ratings.init(dbManager.db.collection("posts"), dbManager.db.collection("ratings"));
  // metadata.init(dbManager.db.collection("metadata"), dbManager).then(() => {
    http.listen(process.env.PORT || 52975, function () {
      getPhotoRollContents();
      console.log("app started");
    });
  }).catch(err => {
    console.log(err);
  });

  dbManager.setAutocompactionInterval(172800000);  
// }).catch((err) => {
//   console.log("An error occured starting the server: ", err)
// })

dbManager.addCollection("accounts");
dbManager.addCollection("posts");
dbManager.addCollection("channels");
dbManager.addCollection("transactions");
dbManager.addCollection("awards");
// dbManager.addCollection("metadata");
dbManager.addCollection("ratings");

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
    adminLevel: req.session.admin,
    promoPhotoSrc: firstPhoto,
    id: null,
    accountId: null
  });
});

app.post("/signIn", (req,res) => {
  if (!("user" in req.body)) { // no username sent
    res.send(false);
    return;
  }
  if (!("pass" in req.body) || req.body.pass.length == 0) { // no password sent
    res.send(false);
    return;
  }
  doSignIn(req.body.user, req.body.pass, req,res);
});

function doSignIn(username, password, req,res) {
  accounts.verifyAccountIdentity(username, password).then((userDoc) => {
    ban.checkBanStatus(userDoc.bans).then((isBanned) => {
      if (isBanned) {
        res.send("banned");
      }
      else {
        const sessionValues = accounts.getSessionValues(userDoc);
        for (const key in sessionValues) {
          req.session[key] = sessionValues[key];
        }
        accounts.addSession(username, req.session, req.sessionID);
        res.send(true);
      }
    }).catch(err => {
      res.send(err);
    });
  }).catch((err) => {
    if (err == "username" || err == "password") res.send(false);
    else res.send(err);
  });
}

/* __________________
  /                  \
  | jmp SIGN UP CODE |
  \__________________/
*/

app.get("/signUp", (req,res) => {
  if (req.session.name) {
    res.redirect("/home");
    return;
  }
  
  let firstPhoto = (photoRollContents.length > 0) ? photoRollContents[Math.floor(Math.random()*photoRollContents.length)] : ""; // need to decide what to do if PhotoRolLContents is empty
  res.render("pages/signUp.ejs", {
    title: "Sign Up",
    isLoggedIn: false,
    isSidebar: false,
    adminLevel: req.session.admin,
    promoPhotoSrc: firstPhoto,
    id: null,
    accountId: null
  });
});

app.post("/createAccount", (req,res) => {
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
    SALTING_ROUNDS
  ).then(() => {
    doSignIn(username, password, req,res);
  }).catch(err => {
    if (err == "user already exists") res.send("username");
    else res.sendStatus(500);
  });
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

  dbManager.db.collection("accounts").findOne({
    "_id": userId
  }, (err, doc) => {
    if (err || !doc) {
      res.send("An error occured");
    }
    else {
      sockets.moveToRoom(req.sessionID, `home-${userId}`);
      res.render("pages/home.ejs", {
        title: "Home",
        isLoggedIn: !!req.session.user,
        isSidebar: true,
        adminLevel: req.session.admin,
        name: doc.name,
        bio: doc.bio ?? "",
        id: req.sessionID,
        accountId: req.session.user,
        viewingAccoundId: userId,
        homeJS: (userId == req.session.user) ? "home.js" : "homeView.js"
      });
    }
  });
});

app.post("/updateBio", (req,res) => {
  if (!req.session.user) {
    res.send(false);
    return;
  }

  const MAX_BIO_LENGTH = 500;

  let bio = (req.body.bio ?? "").toString().substring(0, MAX_BIO_LENGTH); // bio must ALWAYS be a string // limit bio to 500 characters
  dbManager.db.collection("accounts").update({
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
  });
});

app.get("/profile", (req,res) => {
  const id = req.query.id ?? null;
  if (id == null) {
    res.send({});
    return;
  }

  dbManager.db.collection("accounts").findOne({
    "_id": id
  }).exec((err,data) => {
    if (err || !data) { res.send({}); }
    else {
      data.pass = "";
      res.send(data);
    }
  });
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
  dbManager.db.collection("transactions").find({
    _id: {
      $in: transactions
    }
  }, (err,docs) => {
    if (err) res.sendStatus(500);
    else res.send(docs);
  })
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

/* ________________
  /                \
  | jmp POSTS CODE |
  \________________/
*/

app.get("/posts", (req,res) => {
  res.render("pages/posts.ejs", {
    title: "Posts",
    isLoggedIn: !!req.session.user,
    isSidebar: true,
    adminLevel: req.session.admin,
    user: req.session.user,
    id: req.sessionID,
    accountId: req.session.user
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

  dbManager.db.collection("channels").findOne({
    "_id": channel
  }).exec((err, channelData) => {
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
  
    dbManager.db.collection("posts").insert(document, (err, finalDoc) => {
      if (err) {
        res.sendStatus(500);
        return;
      }
      res.send({"msg":"Valid", "body":document});
      sockets.emitToRoom("newDocs", finalDoc._id, `posts-${channel}`);

      dbManager.db.collection("channels").update({
        "_id": channel
      }, {
        $push: {
          "posts": finalDoc._id
        },
        $set: {
          "activity": document.published
        }
      }, (err) => {
        if (err) console.log("ERROR:", err);
      });
    });
  });

});

app.get("/getPosts", (req,res) => {
  const index = parseInt(req.query.index ?? 0);
  const limit = parseInt(req.query.limit || 10);
  const channel = req.query.channel ?? "main";

  dbManager.db.collection("posts").find({
    channel
  }).sort({
    "published": -1
  }).skip(index).limit(limit).exec((err, docs) => {
    if (err) res.sendStatus(500);
    res.send(docs);
  });
});

app.get("/getPost", (req,res) => {
  const id = req.query.id ?? null;
  if (id == null) {
    res.send({});
    return;
  }
  dbManager.db.collection("posts").findOne({
    _id: id
  }).exec((err, data) => {
    if (err) {
      res.send({});
      return;
    }
    res.send(data);
  });
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
  if (!req.session.user || req.session.admin == 0) {
    res.redirect("/");
    return;
  }

  res.render("pages/ban.ejs", {
    title: "Ban",
    isLoggedIn: true,
    isSidebar: true,
    adminLevel: req.session.admin,
    id: req.sessionID,
    accountId: req.session.user
  });
});

app.post("/banUser", (req,res) => {
  if (!req.session.user || req.session.admin == 0) {
    res.sendStatus(403); // not an admin
    return;
  }
  if (!("user" in req.body)) {
    res.send("Missing user to ban");
    return;
  }

  const user = req.body.user;
  const duration = req.body.duration ?? 86400000; // stored in ms // default of 1 day

  ban.ban(user, req.session.user, (new Date()).getTime() + duration).then(banId => {
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
  if (!req.session.user || req.session.admin == 0) {
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

app.get("/award", (req,res) => {
  if (!req.session.user || req.session.admin == 0) {
    res.redirect("/");
    return;
  }
  res.render("pages/award.ejs", {
    title: "Award",
    isLoggedIn: true,
    isSidebar: true,
    adminLevel: req.session.admin,
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

  dbManager.db.collection("awards").find({
    _id: {
      $in: awards
    }
  }, (err,docs) => {
    if (err) res.sendStatus(500);
    else res.send(docs);
  })
});



app.use( express.static(__dirname + '/public') ); // at the end to prevent 404 errors