var postsCollection;
var ratingsCollection;

exports.init = function init(postsCollection1, ratingsCollection1) {
  postsCollection = postsCollection1;
  ratingsCollection = ratingsCollection1;
}

exports.saveRating = function saveRating(
  postId,
  userRating,
  userId
) {
  // filter user input
  if (userRating > 0) userRating = 1;
  else if (userRating < 0) userRating = -1;
  else userRating = 0;

  return new Promise((resolve,reject) => {
    ratingsCollection.findOne({
      _id: postId
    }, (err, ratingDoc) => {
      if (err) {
        reject(err);
        return;
      }
  
      let oldRating = 0;
      // Toutges Conjecture: If none have rated, this user has not yet rated, so
      // their rating need not be checked
      if (ratingDoc) {
        for (let user of ratingDoc.likes) {
          if (user == userId) {
            oldRating = 1;
            break;
          }
        }
        if (oldRating == 0) {
          for (let user of ratingDoc.dislikes) {
            if (user == userId) {
              oldRating = -1;
              break;
            }
          }
        }
      }
  
      // don't need to do anything
      if (oldRating == userRating) {
        const rating = ratingDoc.rating ?? 0;
        resolve([rating, ratingDoc.channel]);
        return;
      }

      let likesInc = userRating - oldRating;
      
      const pull = (oldRating < 0) ? "dislikes" : (oldRating > 0) ? "likes" : null;
      const push = (userRating > 0) ? "likes" : (userRating < 0) ? "dislikes" :null;
      
      // special cases:
      // increment to 1/-1
      // reset to 0

      
      const updateData = {};
      if (pull) { updateData.$pull = { [pull]: userId }; }
      if (push) { updateData.$addToSet = { [push]: userId }; }      

      changeRating(
        postId,likesInc,
        updateData
      ).then(data => {
        resolve(data);
      }).catch(err => {
        reject(err);
      })
    });
  });
}

function createRating(postId) {
  return new Promise((resolve, reject) => {
    ratingsCollection.insert({
      "_id": postId,
      "likes": [],
      "dislikes": []
    }, (err, finalDoc) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(finalDoc);
    });
  });
}

function changeRating(
  postId,
  likeIncrement,
  ratingsUpdateData
) {
  return new Promise((resolve, reject) => {
    let completionCounter = 0;
    const COMPLETION_STEPS = 2;
  
    postsCollection.update({
      _id: postId
    }, {
      $inc: {
        "rating": likeIncrement
      }
    }, {},
    (err, numUpdated) => {
      if (err) {
        reject(err);
        return;
      }
      if (numUpdated == 0) {
        reject("Invalid post id");
        return;
      }

      checkIfComplete();
    });

    ratingsCollection.findOne({
      _id: postId
    }, async (err, postDoc) => {
      if (err) {
        reject(err);
        return;
      }
      if (!postDoc) await createRating(postId); // create new rating document

      ratingsCollection.update({
        _id: postId
      },
      ratingsUpdateData,
      {}, (err, numUpdated) => {
        if (err) {
          reject(err);
          return;
        }
        if (numUpdated == 0) {
          reject("Invalid post id");
          return;
        }
        checkIfComplete();
      });
    });

    function checkIfComplete() {
      completionCounter++
      if (completionCounter != COMPLETION_STEPS) return;

      postsCollection.findOne({
        _id: postId
      }, (err, post) => {
        if (err) {
          reject(err);
          return;
        }
        if (!post) {
          reject("Invalid post id");
          return;
        }

        const rating = post.rating ?? 0;
        resolve([rating, post.channel]);
      });
    }
  });
}

function hasRated(
  userId,
  posts=[]
) {
  return new Promise((resolve,reject) => {
    let finishedCounter = 0;
    const WHEN_FINISHED = 2;
    const ids = {};

    ratingsCollection.find({
      "likes": {
        $elemMatch: userId
      },
      "_id": {
        $in: posts
      }
    }, (err, docs) => {
      if (err) {
        reject(err);
        return;
      }
      
      for (const doc of docs) { ids[doc._id] = 1; }
      finishedCounter++;
      if (finishedCounter == WHEN_FINISHED) {
        resolve(ids);
      }
    });

    ratingsCollection.find({
      "dislikes": {
        $elemMatch: userId
      },
      "_id": {
        $in: posts
      }
    }, (err, docs) => {
      if (err) {
        reject(err);
        return;
      }

      for (const doc of docs) { ids[doc._id] = -1; }
      finishedCounter++;
      if (finishedCounter == WHEN_FINISHED) {
        resolve(ids);
      }
    });
  });
}

exports.createRating = createRating;
exports.changeRating = changeRating;
exports.hasRated = hasRated;
