const $ = document.querySelector.bind(document);

import { Post } from "./modules/post.js";
import { lFill } from "./modules/format.js"
import * as msg from "./modules/messages.js";
import { post, get, HttpError } from "./modules/easyReq.js";
import { Query } from "./modules/query.js";
import { showError } from "./modules/errorable.js"

const query = new Query(window.location.search)
const POST_ANIMATION_TIME = 30;

const isMessageReady = [false, false];
const posts = [];
var lastId = null;
var batchToLoad = 0;
var postToUpdate = 0;

// only load code for someone signed in if EJS indicates the client is signed in
if ($("#logged-in")) initSignedIn();

function initSignedIn() {
  $(".titles.inputs").addEventListener("input", function() {
    if (this.value.trim().length == 0) {
      this.classList.remove("actives");
      isMessageReady[0] = false;
    }
    else {
      this.classList.add("actives");
      isMessageReady[0] = true;
    }
    updatePublishButton();
  });

  $(".texts.inputs").addEventListener("input", function() {
    if (this.innerText.trim().length == 0) {
      this.classList.remove("actives");
      isMessageReady[1] = false;
    }
    else {
      this.classList.add("actives");
      isMessageReady[1] = true;
    }
    updatePublishButton();
  });

  $(".usernames.inputs").addEventListener("click", function() {
    if (!this.classList.contains("actives")) { return; }
    const title = $(".titles.inputs").value.trim();
    const content = $(".texts.inputs").innerHTML.replace(/<br>/g, "\n").trim();

    if (title.length == 0) { renderPostError("Bad Title"); }
    else if (content.length == 0) { renderPostError("Bad Content"); }

    msg.createMessage(
      title,
      content,
      query.get("channel", "main")
    ).then((data) => {
      if (renderPostError(data.msg)) { return }
      $(".titles.inputs").value = "";
      $(".titles.inputs").classList.remove("actives");
      $(".texts.inputs").innerHTML = "";
      $(".texts.inputs").classList.remove("actives");
      $(".usernames.inputs").classList.remove("actives");

      isMessageReady[0] = false;
      isMessageReady[1] = false;

      // renderNewMessage( data.body, true ); // <- handled by sockets for everyone, now
    }).catch(err => {
      const httpError = new HttpError(err.toString());
      switch (httpError.code) {
        case 403:
          showError("Invalid Credentials").then(() => {
            window.location.reload();
          });
          break;
        case 404:
          showError("Invalid Channel").then(() => {
            query.set("channel", "main");
          window.location.search = query.toString();
          });
          break;
        default:
          showError("Error?")
      }
    })
  });

  // update time on preview post
  setInterval(updatePreviewTime, 60000);
  updatePreviewTime();
}

// returns if [data] was an error
function renderPostError(data) {
  $(".titles.inputs").classList.remove("missings");
  $(".texts.inputs").classList.remove("missings");
  switch(data) {
    case "Bad Title":
      $(".titles.inputs").classList.add("missings");
      showError("Bad Title");
      break;
    case "Bad Content":
      $(".texts.inputs").classList.add("missings");
      showError("Bad Content")
      break;
    default:
      return false;
  }
  return true;
}

function updatePreviewTime() {
  const now = new Date();
  $(".published-dates").innerText = `${(now.getMonth()+1)}/${now.getDate()}/${now.getFullYear()}`
  $(".published-times").innerText = `${lFill(now.getHours(),"0")}:${lFill(now.getMinutes(),"0")}`
}

function updatePublishButton() {
  if (isMessageReady[0] && isMessageReady[1]) $(".usernames.inputs").classList.add("actives");
  else $(".usernames.inputs").classList.remove("actives");
}

loadMessages();
function loadMessages() {
  msg.getMessages({
    batch: batchToLoad++,
    channel: query.get("channel", "main")
  }).then((data) => {
    // prevent new messages from being loaded, as they will not actually exist
    if (data.length == 0) { // no messages sent, therefore never more to load
      return;
    }
    
    isLoadingNew = false;
    renderNewMessages(data);

    lastId = data[data.length-1]._id;
  }).catch(err => {
    showError(err.toString());
  });
}

const postHolder = $("#posts-holder");
function renderNewMessages(newPosts) {
  const ids = [];
  for (const i in newPosts) {
    ids.push(newPosts[i]._id);
    // loads in scroll bar quickly
    const postObj = renderNewMessage(newPosts[i], false);
    postObj.hide();
    
    // keeps nice animation
    setTimeout(() => {
      postObj.show();
    }, i * POST_ANIMATION_TIME); // makes a loading animation that looks cool
  }
  
  if (accountId) {
    showUserRatings(ids);
  }
}

function showUserRatings(postIds) {
  get("/ratedPosts", {
    "postIds": postIds.join(",")
  }).then(([ids, success]) => {
    if (success != "success") {
      showError(success);
      return;
    }

    if (!ids || typeof ids != "object") {
      showError(ids);
      return;
    }

    for (let id in ids) {
      for (let i = postToUpdate; i < posts.length; i++) {
        if (posts[i].id == id) {
          if (ids[id] > 0) {
            posts[i].like(false);}
          else { posts[i].dislike(false); }
          break;
        }
      }
    }
    postToUpdate = posts.length; // no need to itterate over irrelevant posts in the future
  }).catch(err => {
    showError(err.toString());
  })
}

function renderNewMessage(post, prepend=false) {
  const postObj = new Post(post, accountId);
  postObj.onRate(onRatePost);
  posts.push(postObj);
  if (prepend) postObj.prependTo(postHolder);
  else postObj.appendTo(postHolder);
  return postObj;
}


// lazy loading circuitry
var isLoadingNew = false; // this also used to control whether or not lazy loading
setInterval(() => {
  if (
      !isLoadingNew && 
      postHolder.childNodes.length != 0 && 
      postHolder.lastChild.getBoundingClientRect().bottom - window.innerHeight < 20
    ) {
    isLoadingNew = true;
    loadMessages();
  }
}, 50);

function onRatePost(userRating, messageId) {
  post("/ratePost", {
    "rating": userRating,
    "id": messageId
  }).then(([data,success]) => {
    if (success != "success") {
      showError(success);
    }
  }).catch(err => {
    showError(err.toString());
  })
}

// socketio stuff
socket.on("newDocs", (id) => {
  get("/getPost", { id }).then((data) => {
    if (data[1] != "success") throw new Error("Fetch error");
    renderNewMessage(data[0], true);
  });
});

socket.on("rating", (data) => {
  data = JSON.parse(data);

  // search for post with matching id
  for (const post of posts) {
    if (post.id == data.id) {
      post.setRating(data.rating);
      break;
    }
  }
});