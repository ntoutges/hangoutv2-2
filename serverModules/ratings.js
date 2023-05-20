var collection;

exports.init = function init(postsCollection) {
  collection = postsCollection;
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
    collection.findOne({
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
  
      let oldRating = 0;
      for (let user of post.likes) {
        if (user == userId) {
          oldRating = 1;
          break;
        }
      }
      if (oldRating == 0) {
        for (let user of post.dislikes) {
          if (user == userId) {
            oldRating = -1;
            break;
          }
        }
      }
  
      // don't need to do anything
      if (oldRating == userRating) {
        const rating = post.rating ?? 0;
        resolve([rating, post.channel]);
        return;
      }
      

      let promise = null;
      if (oldRating == 0 && userRating == 1) { // like
        promise = like(postId, userId);
      }
      else if (oldRating == 1 && userRating == 0) { // unlike
        promise = unlike(postId, userId);
      }
      else if (oldRating == 0 && userRating == -1) { // dislike
        promise = dislike(postId, userId);
      }
      else if (oldRating == -1 && userRating == 0) {// undislike
        promise = undislike(postId, userId);
      }
      else {
        reject("Undefined behaviour");
        return;
      }

      promise.then(data => {
        resolve(data);
      }).catch(err => {
        reject(err);
      })
    });
  });
}

function like(
  postId,
  userId
) {
  return changeRating(
    postId,
    {
      $addToSet: {
        "likes": userId
      },
      $inc: {
        "rating": 1
      }
    }
  )
}

function unlike(
  postId,
  userId
) {
  return changeRating(
    postId,
    {
      $pull: {
        "likes": userId
      },
      $inc: {
        "rating": -1
      }
    }
  )
}

function dislike(
  postId,
  userId
) {
  return changeRating(
    postId,
    {
      $addToSet: {
        "dislikes": userId
      },
      $inc: {
        "rating": -1
      }
    }
  )
}

function undislike(
  postId,
  userId
) {
  return changeRating(
    postId,
    {
      $pull: {
        "dislikes": userId
      },
      $inc: {
        "rating": 1
      }
    }
  )
}

function changeRating(
  postId,
  updateData
) {
  return new Promise((resolve,reject) => {
    collection.update({
      _id: postId
    }, updateData, {},
    (err, numUpdated) => {
      if (err) {
        reject(err);
        return;
      }
      if (numUpdated == 0) {
        reject("Invalid post id");
        return;
      }

      collection.findOne({
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
    });
  });
}