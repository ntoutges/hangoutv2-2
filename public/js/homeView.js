var $ = document.querySelector.bind(document);
import { get, post } from "./modules/easyReq.js";
import * as modules from "./modules/homeModule.js";
import { Profile } from "./modules/profile.js"
import { showError } from "./modules/errorable.js";
import { RevQuery } from "./modules/query.js";

// change styling to make it more obvious when viewing, versus when in own account
$("#display-name").classList.add("viewing");

var profile;
const parentModule = new modules.ParentModule($("#module-parent-container"))
const friendsModule = new modules.FriendsModule(false);
const friendRequestModule = new modules.FriendsRequestModule("loading");

fillProfile().then(() => {
  fillFriends();
  fillSponsor();
});

$("#biography").setAttribute("disabled", "1"); // prevent biography from being changed by viewer

function fillProfile() {
  return new Promise((res,rej) => {
    get("/profile", {
      "id": viewingAccountId
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
  // requested friends available, but don't need to be shown
  friendsModule.set();

  // only send friend request if logged in
  if (accountId) {
    get("/userRelations", {
      userA: accountId,
      userB: viewingAccountId
    }).then(([mode, success]) => {
      if (success != "success") { showError(success); }
      
      friendRequestModule.mode = mode;
      friendRequestModule.set();
      parentModule.appendModule( friendRequestModule, 0,1 );

      friendRequestModule.on("click", () => {
        friendRequestModule.mode = "sending";
        friendRequestModule.set();
        post("/requestFriend", {
          friend: viewingAccountId
        }).then(([data,success]) => {
          if (success != "success") { showError(success); }
          friendRequestModule.mode = "requested";
          friendRequestModule.set();
        })
      })
    });
  }
}

function fillSponsor() {
  $("#display-name-info").innerText = profile.sponsor;
  $("#display-name-info").classList.remove("loadings");
  
  // special styling to root sponsoreds
  if (profile.sponsor == ":root:") {
    $("#display-name-info").classList.add("roots");
  }
  // default styling
  // else {
    const query = new RevQuery({ "user": profile.sponsor });
    $("#display-name-info").setAttribute("href", `/home?${query.toString()}`);
  // }
}

{
  // placeholder modules

  var m = []
  for (var i = 0; i < 4; i++) {
    m.push( new modules.Module() )
  }
  // parentModule.appendModule(m[0],0,1)
  parentModule.appendModule(m[1],0,2)
  parentModule.appendModule(m[2],1,0)
  // parentModule.appendModule(m[3],2,0)
  // parentModule.appendModule(m[4],2,1)
}

// update biography
socket.on("updateBio", (newBio) => {
  $("#biography").value = newBio;
});

socket.on("requestFriend", (data) => {
  if (data.from == accountId || data.to == accountId) {
    friendRequestModule.mode = "requested";
    friendRequestModule.set();
  }
});

socket.on("removeFriend", (data) => {
  const name = (data.from == viewingAccountId) ? data.to : data.from; // name to add is opposite of this account
  friendsModule.popConfirmed(name);
  friendsModule.set();
  if (data.from == accountId || data.to == accountId) {
    friendRequestModule.mode = "unrelated";
    friendRequestModule.set();
  }
});

socket.on("changeFriendsRequest", (data) => {
  const name = (data.from == viewingAccountId) ? data.to : data.from; // name to add is opposite of this account
  const dataRegardsViewer = (data.from == accountId || data.to == accountId);
  // friendsModule.popRequested(name); // not important for viewers
  if (data.action == "accept") {
    friendsModule.addConfirmed(name);
    if (dataRegardsViewer) {
      friendRequestModule.mode = "friends";
      friendRequestModule.set();
    }
  }
  else if (data.action == "reject" && dataRegardsViewer) {
    friendRequestModule.mode = "unrelated";
    friendRequestModule.set();
  }
  friendsModule.set();
});