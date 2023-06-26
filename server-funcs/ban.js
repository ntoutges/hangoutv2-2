//@ts-check

const { doLogout } = require("./signout");

var gBan;
var gSockets;
var gAccounts;

exports.init = ({
  ban,
  sockets,
  accounts
}) => {
  gBan = ban;
  gSockets = sockets;
  gAccounts = accounts;
}

exports.getBan = (req,res) => {
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
}

exports.postBanUser = (req,res) => {
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

  gBan.ban(user, req.session.user, (new Date()).getTime() + duration, types).then(banId => {
    gAccounts.getSessions(user).forEach(({ session, id }) => {
      gSockets.emitTo(id, "ban", true);
      doLogout(session);
    });
    res.send({ id: banId });
  }).catch(err => {
    console.log(err)
    res.send({ err });
  });
}

exports.postUnbanUser = (req,res) => {
  if (!req.session.user || !("ban" in req.session.perms)) {
    res.sendStatus(403); // not an admin
    return;
  }
  if (!("banId" in req.body)) {
    res.send("Missing banId to unban");
    return;
  }

  gBan.unban(req.body.banId).then((user) => {
    // shouldn't really be logged in, so this would be useless
    // accounts.getSessions(user).forEach((session) => {
    //   sockets.emitTo(session.id, "ban", false);
    // });
    res.send({});
  }).catch(err => {
    res.send({ err });
  });
}

exports.getBanStatus = (req,res) => {
  if (!req.session.user) {
    res.sendStatus(403);
    return;
  }
  if (!("banId" in req.query)) {
    res.send("Missing id");
    return;
  }
  
  gAccounts.getAccount(req.session.user).then(doc => {
    if (doc.perms.indexOf(req.query.banId) != -1 || ("login" in req.session.perms)) {
      gBan.checkBanStatus([req.query.banId]).then(restrictions => {
        res.send(Object.keys(restrictions).join(","));
      }).catch(err => { res.send(err.toString()); });
    }
    else { res.sendStatus(403); }
  }).catch(err => {
    console.log(err);
    res.send(err.toString());
  });
}

exports.getBans = (req,res) => {
  if (!("ids" in req.query)) {
    res.send("Missing ids");
    return;
  }
  // if (!Array.isArray(req.query.ids)) {
  //   res.send("Invalid ids");
  //   return;
  // }

  const ids = req.query.ids.split(",");
  gBan.checkBanStatus(ids).then(restrictions => {
    res.send(restrictions);
  }).catch(err => {
    console.log(err);
    res.send({});
  });
}

exports.getBanInfo = (req,res) => {
  if (!("id" in req.query)) {
    res.send("Missing id");
    return;
  }

  gAccounts.getAccount(req.query.id).then(doc => {
    const bans = doc.bans ?? [];
    gBan.checkBanStatus(bans).then(restrictions => {
      res.send(Object.keys(restrictions).join(","));
    }).catch(err => { res.send(err.toString()); });
  }).catch(err => {
    console.log(err);
    res.send(err.toString());
  });
}