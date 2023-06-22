const $ = document.querySelector.bind(document);
import * as req from "./modules/easyReq.js";
import { Query, RevQuery } from "./modules/query.js";

var sequence = [];

const INTERVAL_DURATION = 8000; // measured in ms
const TRANSITION_DURATION = 3500; // measured in ms

var pictureCounter = 0;
var pictureKey = [];
var lastPictures = [];
var MIN_REPEAT_CYCLES = 0;

async function initPhotoRoll() {
  const response = await fetch("../data/roll.json");
  pictureKey = (await response.json()).rawSequence;

  MIN_REPEAT_CYCLES = Math.floor(pictureKey.length / 2);

  try { // prevent error in this inconsequential code from stopping entire photo roll
    const initialSrc = /\?.*/.exec($("#photo-a").getAttribute("src"))[0]; // src that loads in with EJS
    const initialId = (new Query(initialSrc)).props.id;
    const initialIndex = pictureKey.indexOf(initialId);
    if (initialSrc != -1) lastPictures.push(initialIndex);
  }
  catch(err) { console.log(err); }
  
  
  preloadNextSlide();

  if (pictureKey.length > 1) { // don't swap if only one (or zero) photo(s)
    setTimeout(() => {
      swapSlides();
      setInterval(swapSlides, INTERVAL_DURATION);
    }, INTERVAL_DURATION - TRANSITION_DURATION);
  }

  // req.get("/getPhotoRoll", {}).then(([data, success]) => {
  //   if (success == success)
  //   pictureKey = data;
  //   MIN_REPEAT_CYCLES = Math.floor(pictureKey.length / 2);
    
  //   try { // prevent error in this inconsequential code from stopping entire photo roll
  //     const initialSrc = /[^/]+$/.exec($("#photo-a").getAttribute("src"))[0]; // src that loads in with EJS
  //     const initialIndex = pictureKey.indexOf(initialSrc);
  //     if (initialSrc != -1) lastPictures.push(initialIndex);
  //   }
  //   catch(err) { console.log(err); }
    
    
  //   preloadNextSlide();

  //   if (pictureKey.length > 1) // don't swap if only one (or zero) photo(s)
  //     setTimeout(() => {
  //       swapSlides();
  //       setInterval(swapSlides, INTERVAL_DURATION);
  //     }, INTERVAL_DURATION - TRANSITION_DURATION);
  // });
}
initPhotoRoll();

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
    for (let i = $("#slide-b").childNodes.length-1; i >= 0; i--) { // transfer all children (if multiple somehow end up in "slide-b")
      $("#slide-a").append( $("#slide-b").childNodes[i] );
    }
    preloadNextSlide();
  }, TRANSITION_DURATION);
}

function preloadNextSlide() {
  if (pictureKey.length == 0) // can't load another slide if no photos exist
    return;
  pictureCounter = getNextPicture();
  let src = pictureKey[pictureCounter];
  let newPhoto = document.createElement("img");
  newPhoto.setAttribute("src", `/document?id=${src}`);
  newPhoto.setAttribute("id", "photo-b");
  newPhoto.setAttribute("draggable", "false");
  newPhoto.classList.add("photos");
  $("#slide-b").append(newPhoto);
}

// blacklist is assumed to be between [min] and [max]
// returns value in range [min,max]
function randomNum(min,max,blacklist=[]) {
  const nums = max - min - blacklist.length + 1;
  let raw = Math.floor(Math.random() * nums) + min;
  
  while (blacklist.includes(raw)) {
    raw++; // increment until out of blacklist
  }
  return Math.max(Math.min(raw, max),0); // just in case (somehow) [raw] sneaks up too high
}

function getNextPicture() {
  lastPictures.push(pictureCounter);
  if (lastPictures.length > MIN_REPEAT_CYCLES) lastPictures.splice(0,1); // remove first item in array to shorten
  return randomNum(0,pictureKey.length-1, lastPictures)
}
