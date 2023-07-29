var $ = document.querySelector.bind(document);
import { Query, RevQuery } from "./modules/query.js";
import { showMessage } from "./modules/errorable.js";

{
  const POSTS_PATH = "/posts";
  if (window.location.pathname == POSTS_PATH) {
    const query = new Query(window.location.search);
    const channel = query.get("channel", "main");
    let isChannelValid = false; // guilty until proven innocent
    for (const child of $("#posts-selection").children) {
      if (child.value == channel) {
        isChannelValid = true;
        break;
      }
    }

    // only set if channel is valid
    if (isChannelValid) {
      $("#posts-selection").value = channel;
      $("#posts-toolbar-item").setAttribute("href", `${POSTS_PATH}${query.length > 0 ? "?" : ""}${query.toString()}`);
    }
  }

  $("#posts-selection").addEventListener("click", (e) => {
    e.preventDefault(); // prevent click from triggering link when clicking on dropdown
  });

  $("#posts-selection").addEventListener("change", () => {
    const query = new RevQuery({
      "channel": $("#posts-selection").value
    });
    window.location.href = `${POSTS_PATH}?${query.toString()}`;
  });
}

socket.on("ban", (isBanned) => {
  console.log(isBanned)
  if (isBanned) {
    showMessage({
      title: "Ban",
      body: "You have been banned",
    }).then(() => {
      window.location.reload();
    });
  }
  else {
    showMessage({
      title: "Unban",
      body: "Some permissions have been restored",
    }).then(() => {
      window.location.reload();
    });
  }
});