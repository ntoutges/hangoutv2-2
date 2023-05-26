var $ = document.querySelector.bind(document);
import { get, post } from "./modules/easyReq.js";
import * as modules from "./modules/homeModule.js";
import { Profile } from "./modules/profile.js"
import { showError } from "./modules/errorable.js";

var profile;
const parentModule = new modules.ParentModule($("#module-parent-container"));
const friendsModule = new modules.FriendsModule(true);
var oldBio = $("#biography").value;

var defaultProfiles;
var menuFilled = false;

fillProfile().then(() => {
  fillFriends();
  fillAwards();
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

function fillAwards() {
  const awards = new modules.AwardsModule();
  parentModule.appendModule( awards, 0,1 );

  get("/awards", {
    awards: profile.awards.join(",")
  }).then(([awardData,success]) => {
    if (success != "success") {
      showError(success);
      return;
    }
    for (let award of awardData) {
      awards.add(award);
    }
    awards.set();
  });


  // awards.add("test", "award!");
  // awards.add("test", "award1!");
  // awards.add("test", "award2!");
  // awards.add("test", "award3!");
  // awards.add("test", "award4!");
  // awards.add("test", "award5!");
  // awards.add("test", "award6!");
  // awards.add("test", "award7!");
  // awards.add("test", "award8!");
  // awards.add("test2", "award8!");
  // awards.add("test2", "award8!");
  // awards.add("test2", "award8!");
  // awards.add("test2", "award8!");
  // awards.add("test2", "award8!");
  // awards.add("test2", "award8!");
  // awards.set();
}

{
  // placeholder modules
  var m = []
  for (var i = 0; i < 4; i++) {
    m.push( new modules.Module() )
  }
  // parentModule.appendModule(m[0],0,1)
  parentModule.appendModule(m[2],1,0)
}

get("../data/profiles.json", {}).then(([data, success]) => {
  if (success != "success") {
    console.log(success);
    return;
  }
  if (!("defaults" in data)) {
    console.log("Invalid data, missing defaults");
    return;
  }

  defaultProfiles = data.defaults;
}).catch(err => {
  console.log(err);
});

$("#profile-picture-holder").addEventListener("click", openProfileModal);
$("#profile-picture-select-modal").addEventListener("click", closeProfileModal);

function openProfileModal() {
  $("#profile-picture-select-modal").classList.add("actives");

  if (!menuFilled) {
    if (!defaultProfiles) { // wait until set
      let interval = setInterval(() => {
        clearInterval(interval);
        fillMenu( constructProfileMenuItems( defaultProfiles ) );
      }, 100);
    }
    else fillMenu( constructProfileMenuItems( defaultProfiles ) );
  }
}

function closeProfileModal() {
  $("#profile-picture-select-modal").classList.remove("actives");
}

function selectProfile(e, id) {
  e.stopPropagation();

  post("/selectProfilePicture", { id }).then(([errs,success]) => {
    if (success != "success") {
      console.log(success);
      return;
    }
    if (errs) {
      console.log(errs);
      return;
    }
    $("#profile-picture").setAttribute("src", `/document?id=${id}`);
    closeProfileModal();

  }).catch(err => {
    console.log(err);
  })
}

function constructProfileMenuItems(ids) {
  let items = [];
  const upload = document.createElement("div");
  upload.classList.add("rotary-menu-items");
  upload.classList.add("upload-containers");
  upload.innerHTML = `<form action="/setProfilePicture" method="post" enctype="multipart/form-data">
    <input type="file" name="file" id="upload-input">
    <input type="submit" id="upload-submit" accept=".png, .jpeg, .jpg">
  </form>`
  upload.setAttribute("data-full-click", "0");

  items.push(upload);

  for (let id of ids) {
    const img = document.createElement("img");
    img.setAttribute("src", `/document?id=${id}`);
    img.classList.add("rotary-menu-items");
    img.setAttribute("data-id", id);
    img.setAttribute("data-full-click", "1");

    items.push(img);
  }
  return items;
}

function fillMenu(menuItems) {
  $("#profile-picture-select-body").innerHTML = ""; // clear
  const height = Math.tan(Math.PI / menuItems.length) * 100;
  for (let i = 0; i < menuItems.length; i++) {
    const child = document.createElement("div");
    child.classList.add("profile-picture-selectors");
    
    child.style.height = `${height}%`;

    const rot = 2 * Math.PI * i / menuItems.length;
    child.style.transform = `translateY(-50%) rotate(${rot}rad)`;

    const color = `0, ${i * 192 / menuItems.length + 64}, ${128 * i / menuItems.length + 128}`;
    child.style.backgroundColor = `rgb(${color})`;

    const deRotate = document.createElement("div");
    deRotate.classList.add("menu-derotaters");
    deRotate.style.transform = `rotate(${-rot}rad)`;

    deRotate.append(menuItems[i]);
    child.append(deRotate);
    $("#profile-picture-select-body").append(child);

    child.addEventListener("mouseenter", () => {
      $("#profile-picture-select-modal").style.backgroundColor = `rgba(${color},0.9)`;
      // $("#profile-picture").setAttribute("src", menuItems[i].getAttribute("src"));
    });
    child.addEventListener("mouseleave", () => {
      $("#profile-picture-select-modal").style.backgroundColor = "";
      // $("#profile-picture").setAttribute("src", `/getProfilePicture?user=${accountId}`);
    });

    if (menuItems[i].getAttribute("data-full-click") == "1") {
      child.addEventListener( "click", function(e) { selectProfile(e, menuItems[i].getAttribute("data-id")); } );
    }
    else child.addEventListener( "click", e => { e.stopPropagation() });
  }
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

socket.on("removeFriend", (name) => {
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