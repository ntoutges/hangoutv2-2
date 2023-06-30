//@ts-check

var gDbManager;
var gAccounts;
var gBan;
var gTransactions;
var gPhotoRollContents;
var gConfig;

exports.init = ({
  dbManager,
  accounts,
  ban,
  transactions,
  photoRollContents,
  config
}) => {
  gDbManager = dbManager;
  gAccounts = accounts;
  gBan = ban;
  gTransactions = transactions;
  gPhotoRollContents = photoRollContents;
  gConfig = config;
}

exports.getSignUp = (req,res) => {
  // if (req.session.name) {
  //   res.redirect("/home");
  //   return;
  // }

  if (!req.session.user || !("sponsor" in req.session.perms)) {
    res.redirect("/");
    return;
  }

  let firstPhoto = (gPhotoRollContents.length > 0) ? gPhotoRollContents[Math.floor(Math.random()*gPhotoRollContents.length)] : ""; // need to decide what to do if PhotoRolLContents is empty
  res.render("pages/signUp.ejs", {
    title: "Sign Up",
    isLoggedIn: true,
    isSidebar: true,
    permissions: req.session.perms,
    promoPhotoSrc: firstPhoto,
    id: req.sessionID,
    accountId: req.session.user
  });
}

exports.postCreateAccount = (req,res) => {
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
  
  gAccounts.createAccount(
    username,
    password,
    req.session.user,
    parseInt(gConfig["salting-rounds"])
  ).then(() => {
    res.send("Valid")
    // doSignIn(username, password, req,res);
  }).catch(err => {
    if (err == "user already exists") res.send("username");
    else res.sendStatus(500);
  });
}

exports.getSponsored = (req,res) => {
  // not allowed to see (or unable to sponsor) accounts
  if (!req.session.user || !("sponsor" in req.session.perms)) {
    res.send("perms");
    return;
  }

  gDbManager.api.find(
    gDbManager.db.collection("accounts"), {
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
}

exports.postAddPermissions = (req,res) => {
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

  gAccounts.getAccount(req.session.user).then(userDoc => {
    const permissions = userDoc.perms ?? [];
    if (permissions.indexOf(perm) == -1) {
      res.send("Invalid permission");
      return;
    }
    gAccounts.addPermission(id, perm).then(() => {
      res.send("ok");
    }).catch(err => {
      console.log(err);
      res.send("error");
    });
    
  }).catch(err => {
    console.log(err);
    res.send("error");
  });
}

exports.postRemovePermission = (req,res) => {
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

  gAccounts.getAccount(id).then(userDoc => {
    const permissions = userDoc.perms ?? [];
    if (permissions.indexOf(perm) == -1) {
      res.send("Invalid permission");
      return;
    }
    gAccounts.removePermission(id, perm).then(() => {
      res.send("ok");
    }).catch(err => {
      console.log(err);
      res.send("error");
    });
    
  }).catch(err => {
    console.log(err);
    res.send("error");
  });
}

exports.postBanPermission = (req,res) => {
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

  gAccounts.getAccount(id).then(userDoc => {
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
    gBan.ban( id, req.session.user, expiration, [perm]).then(id => {
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
}

exports.postUnbanPermission = (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403); // not signed in
    return;
  }
  if (!("banId" in req.body)) {
    res.send("Missing banId");
    return;
  }
  
  const id = req.body.banId;
  gTransactions.getTransaction(id).then(doc => { // make sure person doing unbanning is also the one who banned permission initially
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

    gBan.unban(id).then(() => {
      res.send("ok");
    }).catch(err => {
      console.log(err);
      res.send("error");
    })
  }).catch(err => {
    console.log(err);
    // res.send("error");
  })
}