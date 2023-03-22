import * as req from "./modules/easyReq.js";

const $ = document.querySelector.bind(document);
const INTERVAL_DURATION = 8000; // measured in ms
const TRANSITION_DURATION = 3500; // measured in ms

var pictureCounter = 0;
var pictureKey = [];

function init() { // prevents code from floating in space
  $("#username").addEventListener("focusin", function() { focusIn.call(this, $("#username-underline") ); });
  $("#username").addEventListener("focusout", function() { focusOut.call(this, $("#username-underline") ); });
  $("#username").addEventListener("keydown", goToPassword);
  $("#password").addEventListener("focusin", function() { focusIn.call(this, $("#password-underline") ); });
  $("#password").addEventListener("focusout", function() { focusOut.call(this, $("#password-underline") ); });
  $("#password").addEventListener("keydown", submitViaEnter);
  $("#submit").addEventListener("click", submitCredentials);

  req.get("/getPhotoRoll", {}).then(([data, success]) => {
    if (success == success)
    pictureKey = data;
    preloadNextSlide();
    
    if (pictureKey.length > 1) // don't swap if only one (or zero) photo(s)
      setTimeout(() => {
        swapSlides();
        setInterval(swapSlides, INTERVAL_DURATION);
      }, INTERVAL_DURATION - TRANSITION_DURATION);
  });
}

function submitCredentials() {
  let username = $("#username").value;
  let password = $("#password").value;
  
  hideWarning($("#username-warning"));
  hideWarning($("#password-warning"));

  if (username.trim().length == 0) { // username cannot be empty, but password can
    displayWarning($("#username-warning"), "invalid username");
    return;
  }

  req.post("/signIn", {
    'user': username,
    "pass": password
  }).then(([data, success]) => {
    console.log(data, success)
    if (success == "success" && data)
      window.location.replace("/home")
    else {
      displayWarning($("#username-warning"), "invalid username or password");
      displayWarning($("#password-warning"), "invalid username or password");
    }
  });
}

function displayWarning(warning, message) {
  warning.style.display = "block";
  warning.innerText = message;
}

function hideWarning(warning) {
  warning.style.display = "none";
  warning.innerText = "";
}

function goToPassword(e) {
  if (e.keyCode == 13) // enter pressed
    $("#password").focus();
  else if (isCharCode(e.keyCode))
    hideWarning( $("#username-warning") );
}

function submitViaEnter(e) {
  if (e.keyCode == 13) // enter pressed
    submitCredentials();
  else if (isCharCode(e.keyCode))
    hideWarning( $("#password-warning") );
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
function focusIn(underlineElement) {
  this.style.backgroundColor = "rgba(0,0,0,0)";
  underlineElement.style.width = "100%";
}

function focusOut(underlineElement) {
  if (this.value.trim().length == 0) {
    this.style.backgroundColor = "";
    underlineElement.style.width = "";
  }
}

function swapSlides() { // move one photo over another
  $("#slide-b").style.display = "block";
  $("#slide-b").offsetWidth; // trigger css refresh
  $("#slide-b").style.left = "0px";
  $("#slide-b").style.opacity = "1";
  setTimeout(() => { // move slides back to original position
    $("#slide-b").classList.add("no-transition");
    $("#slide-b").style.left = "100vw";
    $("#slide-b").style.opacity = "0";
    $("#slide-b").offsetWidth; // trigger css refresh
    $("#slide-b").classList.remove("no-transition");
    $("#slide-b").style.display = "none";
    
    $("#slide-a").innerHTML = ""; // remove anything on this slide
    $("#slide-a").append( $("#slide-b").childNodes );
    preloadNextSlide();
  }, TRANSITION_DURATION);
}

function preloadNextSlide() {
  if (pictureKey.length == 0) // can't load another slide if no photos exist
    return;
  pictureCounter = (pictureCounter + 1) % pictureKey.length;
  let src = pictureKey[pictureCounter];
  let newPhoto = document.createElement("img");
  newPhoto.setAttribute("src", `/getPhoto/${src}`);
  newPhoto.setAttribute("id", "photo-b");
  newPhoto.classList.add("photos");
  $("#slide-b").append(newPhoto);
}


init();