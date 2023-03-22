import * as req from "./easyReq.js";

export function createMessage(title, content) {
  return new Promise((resolve,reject) => {
    try {
      req.post("/createPost", {
        t: title,
        c: content
      }).then(([data, success]) => {
        if (success != "success") reject(new Error("fail"));
        resolve(data);
      });
    }
    catch(err) {
      reject(err);
    }
  })
}

export function getMessages(index=0, limit=2) {
  return new Promise((resolve,reject) => {
    try {
      req.get("/getPosts", {
        index,
        limit
      }).then(([data, success]) => {
        if (success != "success") reject(new Error("fail"));
        resolve(data);
      });
    }
    catch(err) {
      reject(err);
    }
  })
}
