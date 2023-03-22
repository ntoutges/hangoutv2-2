const $ = document.querySelector.bind(document);

import { Post } from "./modules/post.js";
import { lFill } from "./modules/format.js"
import * as msg from "./modules/messages.js";

const isMessageReady = [false, false];
const posts = [];

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
    else if (content.length == 1) { renderPostError("Bad Content"); }

    msg.createMessage(
      title,
      content
    ).then((data) => {
      if (renderPostError(data)) { return }
      $(".titles.inputs").value = "";
      $(".titles.inputs").classList.remove("actives");
      $(".texts.inputs").innerHTML = "";
      $(".texts.inputs").classList.remove("actives");
      $(".usernames.inputs").classList.remove("actives");
    }).catch(err => {
      console.error(err);
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
      break;
    case "Bad Content":
      $(".texts.inputs").classList.add("missings");
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
  msg.getMessages().then((data) => {
    renderNewMessages(data);
  }).catch(err => {
    console.log(err)
  });
}

function renderNewMessages(newPosts) {
  const postHolder = $("#posts-holder");
  for (const post of newPosts) {
    const postObj = new Post(post);
    posts.push(postObj);
    postObj.appendTo(postHolder);
  }
}
