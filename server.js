const express = require('express');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const formidable = require('formidable');
const socketio = require('socket.io');
const jimp = require("jimp");
const fs = require('fs');
const JDON = require("./serverModules/jdon.js");

// const board = require("./serverModules/board.js");

require('dotenv').config(); // give access to .env file

const { functions, initFunctions } = require("./server-funcs/server-funcs.js");

const nedbManager = require("./serverModules/nedb.js");
const mongodbManager =  require("./serverModules/mongodb.js");
const sockets =     require("./serverModules/socketManager.js");
const friends =     require("./serverModules/friends.js");
const transactions= require("./serverModules/transactions.js");
const accounts =    require("./serverModules/accounts.js");
const ban =         require("./serverModules/ban.js");
const awards =      require("./serverModules/awards.js")
const ratings =     require("./serverModules/ratings.js");
const documents =   require("./serverModules/documents.js");
const sync =        require("./serverModules/sync.js");
const logger =      require("./serverModules/logger.js");
const channels =    require("./serverModules/channels.js");

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

app.use( express.static(__dirname + '/public') );

const config = JDON.toJSON(
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

logger.init(fs, __dirname + "/logs", "logs.txt", "logs.html", "lastlog.txt", () => {
  if (config["database-type"] == "nedb") {
    dbManager = nedbManager;
    dbManagerInit = dbManager.init(__dirname + "/db");
    dbManager.setAutocompactionInterval(172800000);
    
    const collections = config["db-collections"].split(",");
    for (const name of collections) {
      dbManager.addCollection(name);
    }
  }
  else if (config["database-type"] == "mongodb") {
    dbManager = mongodbManager;
    dbManagerInit = mongodbManager.init(
      `mongodb+srv://${process.env.mongoUser}:${process.env.mongoPassword}@cluster0.ncf6vii.mongodb.net/?retryWrites=true&w=majority`,
      config["db-name"],
      logger
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
    accounts.init(dbManager.db.collection("accounts"), dbManager.api, config);
    ban.init(transactions, accounts, dbManager.db.collection("accounts"), dbManager.api, logger);
    awards.init(dbManager.db.collection("awards"), documents, dbManager.api);
    ratings.init(dbManager.db.collection("posts"), dbManager.db.collection("ratings"), dbManager.api);
    documents.init(dbManager.db.collection("documents"), jimp, fs, __dirname, "documents", dbManager.api);
    sync.init(accounts, config, process.env, logger);
    channels.init(dbManager.api, dbManager.db.collection("channels"));
    http.listen(process.env.PORT || 52975, () => {
      // getPhotoRollContents();
      constructPhotoRollSequence();
      logger.log("app started!");

      functions.signup.createRoot().then(newRoot => {
        if (newRoot) {
          logger.log("Created :root: account!");
        }
      }).catch(err => {
        logger.log(err);
      });

      // run once every day
      sync.doContinuousSync(1000 * 60 * 60 * 24); // commented out to stop errors from being offline
    });

    // channels.createChannel("archives");

    initFunctions({
      photoRollContents,
      sockets,
      friends,
      transactions,
      accounts,
      ban,
      awards,
      ratings,
      sync,
      documents,
      dbManager,
      config,
      logger,
      "env": process.env,
      formidable,
      "dirname": __dirname
    });

  }).catch(err => {
    console.log(err);
  });
});

// function getPhotoRollContents() {
  //   fs.readdir(__dirname + "/photo-roll/", {}, (err, files) => {
    //     if (err) { console.log(err); }
    //     else { photoRollContents = files; }
    //   });
// }

const photoRollContents = [];
function constructPhotoRollSequence() {
  let rawSequence = [];
  try {
    const roll = fs.readFileSync(__dirname + "/public/data/roll.json", {
      "encoding": "utf8",
      "flag": "r"
    });
    rawSequence = JSON.parse(roll).rawSequence ?? [];
  }
  catch (err) {
    logger.log(err);
    logger.log("Stage 1 - Could not construct PhotoRollSequence");
    return;
  }
  documents.getMainFileURIs( rawSequence ).then(docs => {
    const sequence = [];
    for (let id in docs) {
      let relativeURI = docs[id];
      let lastSplitter = Math.max(relativeURI.lastIndexOf("/"), relativeURI.lastIndexOf("\\"));
      if (lastSplitter != -1) relativeURI = relativeURI.substring(lastSplitter+1);
      sequence.push(relativeURI);
    }

    const fileData = {
      rawSequence,
      sequence
    };
    try {
      fs.writeFileSync(__dirname + "/public/data/roll.json", JSON.stringify(fileData), {
        encoding: "UTF8"
      });
    }
    catch (err) {
      logger.log(err);
      logger.log("Stage 3 - Could not construct PhotoRollSequence");
      return;
    }
    logger.log("Successfully constructed photo roll sequence");
    // photoRollContents = sequence;
    photoRollContents.splice(0); // clear
    for (const item of rawSequence) {
      photoRollContents.push(item);
    }
  }).catch(err => {
    logger.log(err);
    logger.log("Stage 2 - Could not construct PhotoRollSequence");
  })
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
  res.render("pages/signIn2.ejs", {
    title: "Sign In",
    isLoggedIn: false,
    isSidebar: false,
    permissions: req.session.perms,
    promoPhotoId: firstPhoto,
    id: null,
    accountId: null
  });
});

app.post("/signin", functions.signin.postStudentSignIn);

/* ____________________
  /                    \
  | jmp SIGN IN 2 CODE |
  \____________________/
*/

app.get("/signin2", functions.signin.getSignIn);
app.post("/signIn2", functions.signin.postSignIn);

/* __________________
  /                  \
  | jmp SIGN UP CODE |
  \__________________/
*/
// this also known as   | jmp sponsor code |

app.get("/signUp", functions.signup.getSignUp);
app.post("/createAccount", functions.signup.postCreateAccount);
app.get("/sponsored", functions.signup.getSponsored);
app.post("/addPermission", functions.signup.postAddPermissions);
app.post("/removePermission", functions.signup.postRemovePermission);
app.post("/banPermission", functions.signup.postBanPermission);
app.post("/unbanPermission", functions.signup.postUnbanPermission);

/* ___________________
  /                   \
  | jmp SIGN OUT CODE |
  \___________________/
*/

app.get("/signOut", functions.signout.getSignOut);

/* _______________
  /               \
  | jmp HOME CODE |
  \_______________/
*/

app.get("/home", functions.home.getHome);
app.post("/updateBio", functions.home.postUpdateBio);
app.get("/profile", functions.home.getProfile);
app.post("/requestFriend", functions.home.postRequestFriend);
app.post("/removeFriend", functions.home.postRemoveFriend);
app.post("/changeFriendsRequest", functions.home.postChangeFriendsRequest);
app.get("/transactions", functions.home.getTransactions);
app.get("/userRelations", functions.home.getUserRelations);
app.get("/getProfilePicture", functions.home.getGetProfilePicture);
app.post("/setProfilePicture", functions.home.postSetProfilePicture);
app.post("/selectProfilePicture", functions.home.postSelectProfilePicture);

/* ________________
  /                \
  | jmp POSTS CODE |
  \________________/
*/

app.get("/posts", functions.posts.getPosts);
app.post("/createPost", functions.posts.postCreatePost);
app.get("/getPosts", functions.posts.getGetPosts);
app.get("/getPost", functions.posts.getGetPost);
app.post("/ratePost", functions.posts.postRatePost);
app.get("/ratedPosts", functions.posts.getRatedPosts);

/* _____________________
  /                     \
  | jmp PHOTO ROLL CODE |
  \_____________________/
*/

// app.get("/getPhotoRoll", (req,res) => {
//   res.send(photoRollContents);
// });

app.get("/getPhoto/*", functions.photoRoll.getGetPhoto);

/* ______________
  /              \
  | jmp BAN CODE |
  \______________/
*/

app.get("/ban", functions.ban.getBan);
app.post("/banUser", functions.ban.postBanUser);
app.post("/unbanUser", functions.ban.postUnbanUser);
app.get("/banStatus", functions.ban.getBanStatus);
app.get("/bans", functions.ban.getBans);
app.get("/banInfo", functions.ban.getBanInfo);

/* ________________
  /                \
  | jmp AWARD CODE |
  \________________/
*/

app.get("/award", functions.award.getAward);
app.get("/awards", functions.award.getAwards);
app.get("/allAwards", functions.award.getAllAwards);
app.post("/giveAward", functions.award.postGiveAward);
app.post("/removeAward", functions.award.postRemoveAward);

/* _______________
  /               \
  | jmp DOCS CODE |
  \_______________/
*/

app.get("/document", functions.docs.getDocument);

/* _______________
  /               \
  | jmp TEMP CODE |
  \_______________/
*/

