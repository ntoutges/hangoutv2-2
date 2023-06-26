//@ts-check

var gPhotoRollContents;
var gAccounts;
var gBan;

exports.init = ({
  photoRollContents,
  accounts,
  ban
}) => {
  gPhotoRollContents = photoRollContents;
  gAccounts = accounts;
  gBan = ban;
}

exports.getSignIn = (req,res) => {
  if (req.session.name) {
    res.redirect("/home");
    return;
  }
  
  let firstPhoto = (gPhotoRollContents.length > 0) ? gPhotoRollContents[Math.floor(Math.random()*gPhotoRollContents.length)] : ""; // need to decide what to do if PhotoRolLContents is empty
  res.render("pages/signIn.ejs", {
    title: "Sign In",
    isLoggedIn: false,
    isSidebar: false,
    permissions: req.session.perms,
    promoPhotoId: firstPhoto,
    id: null,
    accountId: null
  });
}

exports.postSignIn = (req,res) => {
  if (!("user" in req.body)) { // no username sent
    res.send("Invalid");
    return;
  }
  if (!("pass" in req.body) || req.body.pass.length == 0) { // no password sent
    res.send("Invalid");
    return;
  }
  doSignIn(req.body.user, req.body.pass, req,res);
}

function doSignIn(username, password, req,res) {
  gAccounts.verifyAccountIdentity(username, password).then((userDoc) => {
    gBan.checkBanStatus(userDoc.bans).then((restrictions) => { // these are permissions that have been taken away, aka restrictions
      if ("login" in restrictions) {
        res.send("Temp-Banned");
      }
      else {
        const sessionValues = gAccounts.getSessionValues(userDoc);
        if (!("login" in sessionValues.perms)) { // user is essentially permanently banned from even logging in
          res.send("Perm-Banned");
          return;
        }
        
        for (const key in sessionValues) {
          req.session[key] = sessionValues[key];
        }
        gAccounts.addSession(username, req.session, req.sessionID);
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