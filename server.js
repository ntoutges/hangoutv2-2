const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt')
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const formidable = require('formidable');
const imageMagick = require('node-imagemagick');
const socketio = require('socket.io');
const fs = require('fs');
const Datastore = require('nedb');

const board = require("./board.js");

require('dotenv').config(); // give access to .env file

const m = require(__dirname + "/neDB_ext.js");

const app = express();
app.set('view engine', 'ejs');
app.use(expressLayouts);

// app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())

app.use( session({
  secret: process.env.secret,
  resave: false,
  saveUninitialized: false
}) );

const db = new m.nedbExt(Datastore);
db.addCollection("accounts", __dirname + "/db/accounts.txt");
db.addCollection("posts", __dirname + "/db/posts.txt");

const MS_PER_DAY = 86400000;
db.init(() => {
  const server = app.listen(process.env.PORT || 52975, function () {
    getPhotoRollContents();
    console.log("app started");
  });

  board.init(db);
  // do compaction once every two days
  db.collection("accounts").persistence.setAutocompactionInterval(172800000);
  db.collection("posts").persistence.setAutocompactionInterval(172800000);

  setInterval(board.removeOldMessages.bind(MS_PER_DAY*5), MS_PER_DAY*1);
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
  
  let firstPhoto = (photoRollContents.length > 0) ? photoRollContents[0] : ""; // need to decide what to do if PhotoRolLContents is empty
  res.render("pages/signIn.ejs", {
    title: "Sign In",
    isLoggedIn: false,
    isSidebar: false,
    promoPhotoSrc: firstPhoto
  });
});

app.post("/signIn", (req,res) => {
  let username = req.body.user;
  let password = req.body.pass;
  
  db.collection("accounts").findOne({
    "_id": username
  }, (err, doc) => {
    if (err)
      console.log("ERROR: ", err);
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

  db.collection("accounts").findOne({
    "_id": req.session.user
  }, (err, doc) => {
    if (err) {
      res.send("An error occured");
    }
    else {
      res.render("pages/home.ejs", {
        title: "Home",
        isLoggedIn: true,
        isSidebar: true,
        name: req.session.name,
        bio: doc.bio ?? ""
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

  let bio = (req.body.bio ?? "").toString().substring(0, MAX_BIO_LENGTH); // bio must ALWAYS be a string // limit bio to 200 characters
  db.collection("accounts").update({
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
    user: req.session.user
  });
});

app.post("/createPost", (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }

  if (!("t" in req.body) || req.body.t.trim().length == 0) {
    res.send("Bad Title");
    return;
  }
  if (!("c" in req.body) || req.body.c.trim().length == 0) {
    res.send("Bad Content");
    return;
  }

  const document = {
    "q": req.body.t.trim(),
    "t": req.body.c.trim(),
    "p": (new Date()).getTime(),
    "u": req.session.user
  }

  db.collection("posts").insert(document, (err) => {
    if (err) {
      res.sendStatus(500);
      return;
    }
    res.send("Valid");
  })
});

app.get("/getPosts", (req,res) => {
  db.collection("posts").find({}).sort({
    "p": -1
  }).limit(300).exec((err, docs) => {
    if (err) res.sendStatus(500);
    res.send(docs);
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