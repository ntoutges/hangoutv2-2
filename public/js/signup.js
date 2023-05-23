const $ = document.querySelector.bind(document);
import * as req from "./modules/easyReq.js";


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
        case "username":
          displayWarning("username", "username already taken");
          break;
        case "password":
          displayWarning("password", "invalid password");
          break;
        default:
          window.location.replace("/home")
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
    console.log(this.value)
    this.value = this.value.trim();
  }
}
