function accept(collection, userId, friendId) {
  return updateFriends(
    collection,
    userId,
    friendId,
    [
      ["$pull", "friends.requested", "%f"],
      ["$push", "friends.confirmed", "%f"]
    ]
  )
}

function reject(collection, userId, friendId) {
  return updateFriends(
    collection,
    userId,
    friendId,
    [
      ["$pull", "friends.requested", "%f"]
    ]
  )
}

function remove(collection, userId, friendId) {
  return updateFriends(
    collection,
    userId,
    friendId,
    [
      [ "$pull", "friends.confirmed", "%f" ]
    ]
  )
}

// %f = replace with friend
// %u = replace with user
function updateFriends(collection, friendA_id, friendB_id, updateDataConstruction) {
  return new Promise((resolve,reject) => {
    const updateDataA = {};
    const updateDataB = {};
    
    for (const path of updateDataConstruction) {
      let aHead = updateDataA;
      let bHead = updateDataB;
      for (let i = 0; i < path.length-1; i++) {
        const aInstruction = path[i].replace(/%f/g, friendB_id).replace(/%u/g, friendA_id);
        const bInstruction = path[i].replace(/%f/g, friendA_id).replace(/%u/g, friendB_id);
        
        aHead[aInstruction] = {};
        bHead[bInstruction] = {};

        if (i == path.length-2) { // set final value
          aHead[aInstruction] = path[i+1].replace(/%f/g, friendB_id).replace(/%u/g, friendA_id);
          bHead[bInstruction] = path[i+1].replace(/%f/g, friendA_id).replace(/%u/g, friendB_id);
        }
        else {
          aHead = aHead[aInstruction];
          bHead = bHead[bInstruction];
        }
      }
    }

    let didError = false;
    let activeProcesses = 2;
    
    collection.update({
      "_id": friendB_id
    }, updateDataB, (err,numUpdated) => {
      if (err || numUpdated == 0) {
        if (didError) return; // prevent trying to call reject multiple times
        if (err) reject(err);
        else reject(`${friendB_id} does not exist`);
        didError = true;
      }
      activeProcesses--;
      if (activeProcesses == 0) resolve();
    });
    collection.update({
      "_id": friendA_id
    }, updateDataA, (err,numUpdated) => {
      if (err || numUpdated == 0) {
        if (didError) return; // prevent trying to call reject multiple times
        if (err) reject(err);
        else reject(`${friendA_id} does not exist`);
        didError = true;
      }
      activeProcesses--;
      if (activeProcesses == 0) resolve();
    });
  });
}

exports.accept = accept;
exports.reject = reject;
exports.remove = remove;