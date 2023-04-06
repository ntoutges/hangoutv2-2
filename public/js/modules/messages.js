import * as req from "./easyReq.js";

export function createMessage(title, content, channel) {
  return new Promise((resolve,reject) => {
    try {
      req.post("/createPost", {
        title,
        content,
        channel
      }).then(([data, success]) => {
        if (success != "success") reject(new Error(success));
        resolve(data);
      });
    }
    catch(err) {
      reject(err);
    }
  })
}

export function getMessages({
  batch=0,
  limit=20,
  channel="main"
}) {
  return new Promise((resolve,reject) => {
    try {
      req.get("/getPosts", {
        index: batch*limit,
        limit,
        channel
      }).then(([data, success]) => {
        if (success != "success") reject(new Error(success));
        resolve(data);
      });
    }
    catch(err) {
      reject(err);
    }
  })
}
