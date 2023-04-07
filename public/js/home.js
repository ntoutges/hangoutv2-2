var $ = document.querySelector.bind(document);
import { get, post } from "./modules/easyReq.js";
import * as modules from "./modules/homeModule.js";
import { Profile } from "./modules/profile.js"
import { showError } from "./modules/errorable.js";

var profile;
const parentModule = new modules.ParentModule($("#module-parent-container"));
const friendsModule = new modules.FriendsModule(true);
var oldBio = $("#biography").value;

fillProfile().then(() => {
  fillFriends();
});

const UPDATE_BIOGRAPHY_TIMEOUT = 1000;
var updateBiographyTimeout = null;
$("#biography").addEventListener("input", (e) => {
  // make CSS calculate height
  let text = $("#biography").value;
  $("#biography-sizer").innerText = text.replace(/\n$/, "\n "); // ensure final \n is counted
  let newHeight = $("#biography-sizer").offsetHeight;
  const refHeight = $("#biography").offsetHeight;
  
  let didUpdate = false;
  while (newHeight > refHeight) {
    text = text.substring(0, text.length-1);
    $("#biography-sizer").innerText = text.replace(/\n$/, "\n ");
    newHeight = $("#biography-sizer").offsetHeight;
    didUpdate = true;
  }
  if (didUpdate) $("#biography").value = text;

  if (updateBiographyTimeout) clearTimeout(updateBiographyTimeout);
  updateBiographyTimeout = setTimeout(updateBiography, UPDATE_BIOGRAPHY_TIMEOUT);
});

$("#biography").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key == "s") { // including metaKey for mac
    e.preventDefault(); // prevent save dialogue from appearing
    updateBiography();
  }
})

function updateBiography() {
  clearTimeout(updateBiographyTimeout);
  let text = $("#biography").value.replace(/\s+$/g, ""); // remove whitespace from end of string (but not front)
  setBioMessage("Saving", "loadings actives");
  
  if (oldBio == text) { // fake save message, for people who love pressing ctrl-s without actually changing anything
    setTimeout(() => {
      setBioMessage("Saved!", "actives");
  
      setTimeout(() => {
        setBioMessage();
      }, 1000);
    }, Math.random()*200);
  }
  else { // real save message, for when something is actually changed
    post("/updateBio", {
      bio: text
    }).then((data) => {
      if (data[1] != "success" || !data[0]) setBioMessage("Unsaved", "fails actives");
      else setBioMessage("Saved!", "actives");
  
      setTimeout(() => {
        setBioMessage();
      }, 1000)
    });
  }
  oldBio = text;
}

function setBioMessage(msg=null, classState="") {
  if (msg != null) $("#bio-save-message").innerText = msg;
  $("#bio-save-message").setAttribute("class", classState);
}


function fillProfile() {
  return new Promise((res,rej) => {
    get("/profile", {
      "id": accountId
    }).then((data) => {
      if (data[1] != "success") { rej(data[1]); }
      else {
        profile = new Profile(data[0]);
        res();
      }
    });
  });
}

function fillFriends() {
  parentModule.appendModule(friendsModule, 0,0);
  for (const confirmed of profile.friends.confirmed) {
    friendsModule.addConfirmed(confirmed);
  }
  if (profile.friends.requested.length > 0) {
    get("/transactions", {
      transactions: profile.friends.requested,
    }).then(([transactions,success]) => {
      if (success != "success") {
        showError(success);
        return;
      }
      for (const transaction of transactions) {
        const friend = transaction.parties[(transaction.parties[0] == accountId) ? 1 : 0];
        friendsModule.addRequested(friend, transaction); // .from not entirely accurate...
      };
      friendsModule.set();
    });
  }
  else friendsModule.set();

  friendsModule.on("accept", (transaction) => {
    post("/changeFriendsRequest", {
      "action": "accept",
      "transaction": transaction
    }).then(([data,success]) => {
      if (success != "success") showError(success);
      else if (data != "success") showError(data);
    });
  });
  friendsModule.on("reject", (transaction) => {
    post("/changeFriendsRequest", {
      "action": "reject",
      "transaction": transaction
    }).then(([data,success]) => {
      if (success != "success") showError(success);
      else if (data != "success") showError(data);
    });
  });
  friendsModule.on("remove", (name) => {
    post("/removeFriend", {
      "friend": name
    }).then(([data,success]) => {
      if (success != "success") showError(success);
      else if (data != "success") showError(data);
    });
  })
}

{
  // placeholder modules
  var m = []
  for (var i = 0; i < 4; i++) {
    m.push( new modules.Module() )
  }
  parentModule.appendModule(m[0],0,1)
  parentModule.appendModule(m[2],1,0)
}

// update biography
socket.on("updateBio", (newBio) => {
  $("#biography").value = newBio;
});

socket.on("requestFriend", (data) => {
  const name = (data.from == accountId) ? data.to : data.from; // name to add is opposite of this account
  friendsModule.addRequested(name, data.transaction);
  friendsModule.set();
});

socket.on("removeFriend", (data) => {
  const name = (data.from == accountId) ? data.to : data.from; // name to add is opposite of this account
  friendsModule.popConfirmed(name);
  friendsModule.set();
});

socket.on("changeFriendsRequest", (data) => {
  const name = (data.from == accountId) ? data.to : data.from; // name to add is opposite of this account
  friendsModule.popRequested(name);
  if (data.action == "accept") {
    friendsModule.addConfirmed(name);
  }
  friendsModule.set();
});