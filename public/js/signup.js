const $ = document.querySelector.bind(document);
import * as req from "./modules/easyReq.js";
import { RevQuery } from "./modules/query.js";

var sponsorPermissions = [];
var currentSponsored = null;

function init() { // prevents code from floating in space
  focusIn.call($("#username"), "username" ); // autofocus

  $("#username").addEventListener("focusin", function() { focusIn.call(this, "username" ); });
  $("#username").addEventListener("focusout", function() { focusOut.call(this, "username" ); });
  $("#username").addEventListener("keydown", goToPassword);
  $("#password").addEventListener("focusin", function() { focusIn.call(this, "password" ); });
  $("#password").addEventListener("focusout", function() { focusOut.call(this, "password" ); });
  $("#password").addEventListener("keydown", goToConfirm);
  $("#confirm").addEventListener("focusin", function() { focusIn.call(this, "confirm" ); });
  $("#confirm").addEventListener("focusout", function() { focusOut.call(this, "confirm" ); });
  $("#confirm").addEventListener("keydown", submitViaEnter);
  $("#submit").addEventListener("click", submitCredentials);

  req.get("/sponsored", {}).then(([data,success]) => {
    if (success != "success" || data == "error") {
      $("#accounts-container").innerText = "Error, try again";
      return;
    }
    if (data == "perms") {
      $("#accounts-container").innerText = "Invalid Permissions";
      return;
    }
    
    let oldSelect = null;
    for (const doc of data) {
      const row = document.createElement("div");
      row.setAttribute("class", "sponsored-rows");

      // const query = new RevQuery({ "user": doc._id });
      // row.setAttribute("href", `/home?${query.toString()}`);
      
      row.addEventListener("click", function() {
        if (oldSelect) oldSelect.classList.remove("selected");
        oldSelect = this;
        oldSelect.classList.add("selected");
        
        loadPermissions(doc._id);
      });

      row.innerText = doc._id;
      $("#accounts-container").append(row);
    }
  });

  req.get("/profile", {
    id: accountId
  }).then(([data,success]) => {
    if (success != "success") {
      console.log(success);
      return;
    }
    if (!data) {
      console.log("Unable to request account id");
      return;
    }

    if ("perms" in data) {
      sponsorPermissions = data.perms ?? [];
    }
  });

  $("#ban-expiration-date").valueAsDate = new Date();
}

function submitCredentials() {
  const username = $("#username").value.trim();
  const password = $("#password").value;
  const confirm = $("#confirm").value;

  hideWarning("username");
  hideWarning("password");
  hideWarning("confirm")

  if (username.trim().length == 0) { // username cannot be empty, but password can
    displayWarning("username", "invalid username");
    return;
  }

  if (password.length == 0) { // empty password
    displayWarning("password", "invalid password");
    return;
  }

  if (password != confirm) {
    displayWarning("password", "passwords do not match");
    displayWarning("confirm", "passwords do not match");
    return;
  }

  req.post("/createAccount", {
    'user': username,
    "pass": password
  }).then(([data, success]) => {
    console.log(data, success)
    if (success == "success" && data) {
      switch (data) {
        case "perms":
          displayWarning("username", "Not allowed to create account")
          displayWarning("password", "Not allowed to create account")
          break;
        case "user":
          displayWarning("username", "username already taken");
          break;
        case "pass":
          displayWarning("password", "invalid password");
          break;
        default:
          const query = new RevQuery({ user: username });
          window.location.replace(`/home?${query.toString()}`);
      }
    }
    else {
      displayWarning("username", "invalid username or password");
      displayWarning("password", "invalid username or password");
      displayWarning("confirm", "invalid username or password");
    }
  });
}
init();

const warningTimeouts = [];
function displayWarning(idModifier, message) {
  warningTimeouts.forEach((timeoutId) => { clearTimeout(timeoutId); });
  
  const warning = $(`#${idModifier}-warning`);
  warning.style.display = "block";
  warning.innerText = message;
  warning.offsetHeight; // force CSS reflow
  warning.classList.add("actives");
  $(`#${idModifier}-identifier`).classList.add("disabled");
}

function hideWarning(idModifier) {
  const warning = $(`#${idModifier}-warning`);
  if (!warning.classList.contains("actives")) return; // warning already hidden
  
  warning.innerText = "";
  warning.classList.remove("actives");
  $(`#${idModifier}-identifier`).classList.remove("disabled");
  warningTimeouts.push(
    setTimeout(() => { // give time for animation to play out
      warning.style.display = "none";
    }, 200)
  );
}

function goToPassword(e) {
  if (e.keyCode == 13) // enter pressed
    $("#password").focus();
  else if (isCharCode(e.keyCode))
    hideWarning("username");
}

function goToConfirm(e) {
  if (e.keyCode == 13) // enter pressed
    $("#confirm").focus();
  else if (isCharCode(e.keyCode))
    hideWarning("password"); 
}

function submitViaEnter(e) {
  if (e.keyCode == 13) // enter pressed
    submitCredentials();
  else if (isCharCode(e.keyCode))
    hideWarning("confirm");
}

function isCharCode(keyCode) {
  // let isLetter = keyCode >= 65 && keyCode <= 90;
  // let isNumber = keyCode >= 48 && keyCode <= 57;
  let isModifier = (keyCode >= 16 && keyCode <= 18) || (keyCode >= 112 && keyCode <= 123);
  let isNext = keyCode == 9 || keyCode == 13 || keyCode == 20;
  let isMovement = (keyCode >= 33 && keyCode <= 40);
  return !(isModifier || isNext || isMovement); // tab or enter
}

// mainly decoration below this
function focusIn(idModifier) {
  this.classList.add("actives");
  $(`#${idModifier}-underline`).classList.add("actives");
  $(`#${idModifier}-identifier`).classList.add("actives");
}

function focusOut(idModifier) {
  const isInvalid = (idModifier == "username" && this.value.trim().length == 0);
  if (isInvalid) {
    this.classList.remove("actives");
    $(`#${idModifier}-underline`).classList.remove("actives");
    $(`#${idModifier}-identifier`).classList.remove("actives");
    this.value = this.value.trim();
  }
}

function loadPermissions(id) {
  $("#available-permissions").innerHTML = "";
  $("#removable-permissions").innerHTML = "";
  $("#bannable-permissions").innerHTML = "";
  $("#unbannable-permissions").innerHTML = "";

  req.get("/profile", { id }).then(([data,success]) => {
    if (success != "success") {
      console.log(success);
      return;
    }
    if (!data) {
      console.log("Profile does not exist");
      return;
    }
    
    currentSponsored = id;
    const permissions = (data.perms) ?? [];
    for (const perm of permissions) {
      const option1 = document.createElement("option");
      option1.setAttribute("value", perm);
      option1.innerText = perm;
      const option2 = document.createElement("option");
      option2.setAttribute("value", perm);
      option2.innerText = perm;
      $("#bannable-permissions").append(option1);
      $("#removable-permissions").append(option2);

    }
    for (const perm of sponsorPermissions) {
      // sponsored account doesn't already have permission
      if (permissions.indexOf(perm) == -1) {  
        const option3 = document.createElement("option");
        option3.setAttribute("value", perm);
        option3.innerText = perm;
        $("#available-permissions").append(option3);
      }
    }

    const banIds = data.bans ?? [];
    for (const banId of banIds) {
      const option4 = document.createElement("option");
      option4.setAttribute("value", banId);
      option4.innerText = banId;
      $("#unbannable-permissions").append(option4);
    }
    if (banIds.length != 0) updateBanType();
  });
}

$("#submit-available-permissions").addEventListener("click", () => {
  const val = $("#available-permissions").value;
  if (!val) return;

  req.post("/addPermission", {
    id: currentSponsored,
    perm: val
  }).then(([data,success]) => {
    if (success != "success") {
      console.log(success);
      return;
    }
    loadPermissions(currentSponsored); // reload info
  });
});

$("#submit-removable-permissions").addEventListener("click", () => {
  const val = $("#removable-permissions").value;
  if (!val) return;

  req.post("/removePermission", {
    id: currentSponsored,
    perm: val
  }).then(([data,success]) => {
    if (success != "success") {
      console.log(success);
      return;
    }
    loadPermissions(currentSponsored); // reload info
  });
});

$("#submit-bannable-permissions").addEventListener("click", () => {
  const val = $("#bannable-permissions").value;
  const expiration = $("#ban-expiration-date").valueAsDate.getTime();
  if (!val) return;

  req.post("/banPermission", {
    id: currentSponsored,
    perm: val,
    expiration
  }).then(([data,success]) => {
    if (success != "success") {
      console.log(success);
      return;
    }
    loadPermissions(currentSponsored); // reload info
  });
});

$("#submit-unbannable-permissions").addEventListener("click", () => {
  const val = $("#unbannable-permissions").value;
  if (!val) return;

  req.post("/unbanPermission", {
    banId: val
  }).then(([data,success]) => {
    if (success != "success") {
      console.log(success);
      return;
    }
    loadPermissions(currentSponsored); // reload info
  });
});



$("#unbannable-permissions").addEventListener("change", updateBanType);

function updateBanType() {
  req.get("/banStatus", {
    banId: $("#unbannable-permissions").value
  }).then(([data,success]) => {
    $("#unban-effects").innerText = data;
  }).catch(err => { console.log(err); });
}