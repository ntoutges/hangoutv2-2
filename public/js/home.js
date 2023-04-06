var $ = document.querySelector.bind(document);
import { get, post } from "./modules/easyReq.js";
import * as modules from "./modules/homeModule.js";
import { Profile } from "./modules/profile.js"

var profile;
const parentModule = new modules.ParentModule($("#module-parent-container"))

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

function updateBiography() {
  let text = $("#biography").value.replace(/\s+$/g, ""); // remove whitespace from end of string (but not front)
  setBioMessage("Saving", "loadings actives");
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
  const friendsModule = new modules.FriendsModule();
  parentModule.appendModule(friendsModule, 0,0);
  for (const confirmed of profile.friends.confirmed) {
    friendsModule.addConfirmed(confirmed);
  }
  get("/transactions", {
    transactions: profile.friends.requested,
  }).then(([transactions,success]) => {

    for (const transaction of transactions) {
      friendsModule.addRequested(transaction.parties[1], transaction._id); // .from not entirely accurate...
    };
    friendsModule.set();
  })

  friendsModule.on("accept", (transaction) => {
    post("/changeFriendsRequest", {
      "action": "accept",
      "transaction": transaction
    }).then(([data,success]) => {
      console.log(data,success)
    });
  });
  friendsModule.on("reject", (transaction) => {
    post("/changeFriendsRequest", {
      "action": "reject",
      "transaction": transaction
    }).then(([data,success]) => {
      console.log(data,success)
    });
  });
  friendsModule.on("remove", (name) => {
    post("/removeFriend", {
      "friend": name
    }).then(([data,success]) => {
      console.log(data,success)
    });
  })
}



var m = []
for (var i = 0; i < 10; i++) {
  m.push( new modules.Module() )
}
parentModule.appendModule(m[1],0,1)
parentModule.appendModule(m[2],0,2)
parentModule.appendModule(m[3],1,0)
parentModule.appendModule(m[4],2,0)
parentModule.appendModule(m[5],2,1)
