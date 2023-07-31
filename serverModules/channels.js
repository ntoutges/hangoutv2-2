var collection;
var api

exports.init = (lApi, lCollection) => {
  api = lApi;
  collection = lCollection;
}

exports.createChannel = (channel) => {
  return new Promise((resolve,reject) => {
    api.findOne(
      collection,
      {
        "_id": channel,
      },
      (err,doc) => {
        if (err) {
          reject({
            "err": err.toString(),
            "code": 186,
            "type": `Error creating channel ${channel}`
          });
          return;
        }
        if (doc) { // cannot recreate channel
          reject({
            "err": "channel already exists",
            "code": -187,
            "type": `channel ${channel} already exists`
          });
          return;
        }

        const channelDoc = {
          "_id": channel,
          "posts": [],
          "activity": (new Date()).getTime()
        };

        api.insert(
          collection,
          channelDoc,
          (err, newDoc) => {
            if (err) {
              reject({
                "err": err.toString(),
                "code": 188,
                "type": `Error inserting channel ${channel}`
              });
              return;
            }
            resolve();
          }
        )
      }
    )
  });
}