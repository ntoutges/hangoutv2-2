//@ts-check

var gDbManager;
var gSockets;
var gRatings;
var gLogger;

exports.init = ({
  dbManager,
  sockets,
  ratings,
  logger
}) => {
  gDbManager = dbManager;
  gSockets = sockets;
  gRatings = ratings;
  gLogger = logger;
}

exports.getPosts = (req,res) => {
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
  gSockets.moveToRoom(req.sessionID, `posts-${channel}`);
}

exports.postCreatePost = (req,res) => {
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

  gDbManager.api.findOne(
    gDbManager.db.collection("channels"), {
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
    
      gDbManager.api.insert(
        gDbManager.db.collection("posts"),
        document,
        (err, finalDocId) => {
          if (err) {
            res.sendStatus(500);
            return;
          }
          res.send({"msg":"Valid", "body":document});
          gSockets.emitToRoom("newDocs", finalDocId, `posts-${channel}`);
    
          gDbManager.api.update(
            gDbManager.db.collection("channels"), {
              "_id": channel
            }, {
              $push: {
                "posts": finalDocId
              },
              $set: {
                "activity": document.published
              }
            }, (err) => {
              if (err) gLogger.log("ERROR:", err);
            }
          );
        }
      );
    }
  );
}

exports.getGetPosts = (req,res) => {
  const index = parseInt(req.query.index ?? 0);
  const limit = parseInt(req.query.limit || 10);
  const channel = req.query.channel ?? "main";

  gDbManager.api.findSortSkipLimit(
    gDbManager.db.collection("posts"),
    { channel },
    { "published": -1 },
    index,
    limit,
    (err, docs) => {
      if (err) res.sendStatus(500);
      res.send(docs);
    }
  );
}

exports.getGetPost = (req,res) => {
  const id = req.query.id ?? null;
  if (id == null) {
    res.send({});
    return;
  }

  gDbManager.api.findOne(
    gDbManager.db.collection("posts"), {
      "_id": id
    }, (err, data) => {
      if (err) {
        res.send({});
        return;
      }
      res.send(data);
    }
  );
}

exports.postRatePost = (req,res) => {
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

  gRatings.saveRating(id, rating, req.session.user).then(([newRating, channel]) => {
    const socketData = {
      "rating": newRating,
      "id": id
    };
    gSockets.emitToRoom(
      "rating",
      JSON.stringify(socketData),
      `posts-${channel}`
    );
    res.send(true);
  }).catch(err => {
    gLogger.log(err.toString());
    res.send(err.toString());
  })
}

exports.getRatedPosts = (req,res) => {
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

  gRatings.hasRated(
    req.session.user,
    req.query.postIds.split(",")
  ).then((ids) => {
    res.send(ids);
  }).catch(err => {
    gLogger.log(err);
    res.send(false);
  });
}