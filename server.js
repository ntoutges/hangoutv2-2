const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt')
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const formidable = require('formidable');
const imageMagick = require('node-imagemagick');
const socketio = require('socket.io');
const fs = require('fs');

const board = require("./board.js");

require('dotenv').config(); // give access to .env file

const dbManager = require("./db.js");
const sockets = require("./socketManager.js");
const friends = require("./friends.js");

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

dbManager.init(__dirname + "/db").then(() => {
  http.listen(process.env.PORT || 52975, function () {
    getPhotoRollContents();
    console.log("app started");
  });
  board.init(dbManager.db);
  sockets.init(http);

  dbManager.setAutocompactionInterval(172800000);
  // setInterval(board.removeOldMessages.bind(MS_PER_DAY*5), MS_PER_DAY*1);

}).catch((err) => {
  console.log("An error occured starting the server: ", err)
})

dbManager.addCollection("accounts");
dbManager.addCollection("posts");
dbManager.addCollection("channels");

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
  
  let firstPhoto = (photoRollContents.length > 0) ? photoRollContents[0] : ""; // need to decide what to do if PhotoRolLContents is empty
  res.render("pages/signIn.ejs", {
    title: "Sign In",
    isLoggedIn: false,
    isSidebar: false,
    promoPhotoSrc: firstPhoto,
    id: null,
    accountId: null
  });
});

app.post("/signIn", (req,res) => {
  let username = req.body.user;
  let password = req.body.pass;
  
  dbManager.db.collection("accounts").findOne({
    "_id": username
  }).exec((err, doc) => {
    if (err) {
      console.log("ERROR: ", err);
    }
    else if (doc) {
      let passwordHash = doc.pass;
      bcrypt.compare(password, passwordHash, function(err, matches) {
        if (err) {
          res.send(false);
          return;
        }
        if (matches) {
          req.session.name = doc.name;
          req.session.user = username;
          res.send(true);
        }
        else // password doesn't match
          res.send(false);
      });
    }
    else // username doesn't match
      res.send(false);
  });

});

/* ___________________
  /                   \
  | jmp SIGN OUT CODE |
  \___________________/
*/

app.get("/signOut", (req,res) => {
  req.session.destroy();
  res.redirect("/");
});

/* _______________
  /               \
  | jmp HOME CODE |
  \_______________/
*/

app.get("/home", (req,res) => {
  // TEMP CODE
  // req.session.user = "test";
  // req.session.name = "Nicholas T";

  if (!req.session.user) {
    res.redirect("/");
    return;
  }

  dbManager.db.collection("accounts").findOne({
    "_id": req.session.user
  }, (err, doc) => {
    if (err) {
      res.send("An error occured");
    }
    else {
      sockets.moveToRoom(req.sessionID, "home");
      res.render("pages/home.ejs", {
        title: "Home",
        isLoggedIn: true,
        isSidebar: true,
        name: req.session.name,
        bio: doc.bio ?? "",
        id: req.sessionID,
        accountId: req.session.user
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
    else
      res.send(true);
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
    if (err) { res.send({}); }
    else {
      data.pass = "";
      res.send(data);
    }
  });
});

app.post("/changeFriends", (req,res) => {
  // don't know who to modify if not logged in
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }
  // missing essential data
  if (!("action" in req.body) || !("friend" in req.body)) {
    res.sendStatus(400);
    return;
  }
  const collection = dbManager.db.collection("accounts");
  let functionToCall;
  switch (req.body.action) {
    case "accept":
      functionToCall = friends.accept;
      // friends.accept( collection, req.session.user, req.body.friend )
      break;
    case "reject":
      functionToCall = friends.reject;
      // friends.reject( collection, req.session.user, req.body.friend )
      break;
    case "remove":
      functionToCall = friends.remove;
      // friends.remove( collection, req.session.user, req.body.friend )
      break;
    default:
      res.sendStatus(400);
      return;
  }
  functionToCall(collection, req.session.user, req.body.friend).then(() => {
    res.sendStatus(200);
  }).catch((err) => {
    console.log(err)
    res.sendStatus(500);
  })
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
  const channel = req.query.channel ?? "main"

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
})

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

app.use( express.static(__dirname + '/public') ); // at the end to prevent 404 errors