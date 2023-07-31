var postsCollection;
var ratingsCollection;
var api;

exports.init = function init(postsCollection1, ratingsCollection1, dbAPI) {
  postsCollection = postsCollection1;
  ratingsCollection = ratingsCollection1;
  api = dbAPI;
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
    api.findOne(
      ratingsCollection, {
        _id: postId
      }, (err, ratingDoc) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 147,
            "type": `Error trying to find rating for post [${postId}]`
          });
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
        }).catch(err => { reject(err); });
      }
    );
  });
}

function createRating(postId) {
  return new Promise((resolve, reject) => {
    api.insert(
      ratingsCollection, {
        "_id": postId,
        "likes": [],
        "dislikes": []
      }, (err, finalDocId) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 148,
            "type": `unable to create rating for post [${postId}]`
          });
          return;
        }
        resolve(finalDocId);
      }
    );
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
  
    api.update(
      postsCollection, {
        _id: postId
      }, {
        $inc: {
          "rating": likeIncrement
        }
      }, (err, numUpdated) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 149,
            "type": `Error updating post [${postId}]`
          });
          return;
        }
        if (numUpdated == 0) {
          reject({
            "err": "Post does not exist",
            "code": -150,
            "type": `unable to update post with id [${postId}]`
          });
          return;
        }
  
        checkIfComplete();
      }
    )

    api.findOne(
      ratingsCollection, {
        _id: postId
      }, async (err, postDoc) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 151,
            "type": `Error when finding [${postId}]`
          });
          return;
        }
        if (!postDoc) await createRating(postId); // create new rating document
  
        api.update(
          ratingsCollection,
          {
            _id: postId
          },
          ratingsUpdateData, (err, numUpdated) => {
            if (err) {
              reject({
                "err": err.toString(),
                "code": 152,
                "type": `Error updating rating for post [${postId}]`
              });
              return;
            }
            if (numUpdated == 0) {
              reject({
                "err": "Rating does not exist",
                "code": -153, // I don't think this is critical...
                "type": `unable to find rating for post [${postId}]`
              });
              return;
            }
            checkIfComplete();
          }
        );
      }
    );

    function checkIfComplete() {
      completionCounter++
      if (completionCounter != COMPLETION_STEPS) return;

      // complete, now do final task
      api.findOne(
        postsCollection, {
          _id: postId
        }, (err, post) => {
          if (err) {
            reject({
              "err": err.toString(),
              "code": 154,
              "type": `Error when finding post with id [${postId}]`
            });
            return;
          }
          if (!post) { // theoretically, this should never be invoked, because the post was just used earlier
            reject({
              "err": "Post does not exist",
              "code": -155,
              "type": `unable to find post with id [${postId}]`
            });
            return;
          }
  
          const rating = post.rating ?? 0;
          resolve([rating, post.channel]);
        }
      );
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

    api.find(
      ratingsCollection, {
        "likes": {
          $elemMatch: {
            $eq: userId
          }
        },
        "_id": {
          $in: posts
        }
      }, (err, docs) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 156,
            "type": `Error finding posts that ${userId} has liked`
          });
          return;
        }
        
        for (const doc of docs) { ids[doc._id] = 1; }
        finishedCounter++;
        if (finishedCounter == WHEN_FINISHED) {
          resolve(ids);
        }
      }
    );

    api.find(
      ratingsCollection, {
        "dislikes": {
          $elemMatch: {
            $eq: userId
          }
        },
        "_id": {
          $in: posts
        }
      }, (err, docs) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 157,
            "type": `Error finding posts that ${userId} has disliked`
          });
          return;
        }
  
        for (const doc of docs) { ids[doc._id] = -1; }
        finishedCounter++;
        if (finishedCounter == WHEN_FINISHED) {
          resolve(ids);
        }
      }
    );
  });
}

exports.createRating = createRating;
exports.changeRating = changeRating;
exports.hasRated = hasRated;
