const award = require("./award.js");
const ban = require("./ban.js");
const docs = require("./docs.js");
const home = require("./home.js");
const photoRoll = require("./photo-roll.js");
const posts = require("./posts.js");
const signin = require("./signin.js");
const signout = require("./signout.js");
const signup = require("./signup.js");
const temp = require("./temp.js");

exports.functions = {
  award,
  ban,
  docs,
  home,
  photoRoll,
  posts,
  signin,
  signout,
  signup,
  temp
};

exports.initFunctions = (initData) => {
  award.init(initData);
  ban.init(initData);
  docs.init(initData);
  home.init(initData);
  // photoRoll.init(initData); // init as of yet unnecessary
  posts.init(initData);
  signin.init(initData);
  signout.init(initData);
  signup.init(initData);
  temp.init(initData);
}