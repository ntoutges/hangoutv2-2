//@ts-check

var gDbManager;

exports.init = ({
  dbManager
}) => {
  gDbManager = dbManager;
}

exports.getAward = (req,res) => {
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
}

exports.getAwards = (req,res) => {
  if (!("awards" in req.query)) {
    res.send([]); // don't need to check database to know there is no data
    return;
  }
  if (typeof req.query.awards != "string") {
    res.sendStatus(400); // user error -- wrong data type
    return;
  }

  const awards = req.query.awards.split(",");

  gDbManager.api.find(
    gDbManager.db.collection("awards"), {
      _id: {
        $in: awards
      }
    }, (err,docs) => {
      if (err) res.sendStatus(500);
      else res.send(docs);
    }
  );
}

exports.getAllAwards = (req,res) => {
  gDbManager.api.find(
    gDbManager.db.collection("awards"), {},
    (err,docs) => {
      if (err) res.sendStatus(500);
      else res.send(docs);
    }
  );
}

exports.postGiveAward = (req,res) => {
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

  gDbManager.api.update(
    gDbManager.db.collection("accounts"), {
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
}

exports.postRemoveAward = (req,res) => {
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

  gDbManager.api.update(
    gDbManager.db.collection("accounts"), {
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
}