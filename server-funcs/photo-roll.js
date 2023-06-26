exports.init = ({

}) => {
  
}

exports.getGetPhoto = (req,res) => {
  let pathname = req._parsedOriginalUrl.pathname;
  let photoRequested = pathname.replace("/getPhoto/", "").replace(/[\\,/]/g, ""); // take out any slashes that could lead to exploits
  photoRequested = photoRequested.replace(/%20/g, " "); // unescape space characters in the name
  res.sendFile(__dirname + "/photo-roll/" + photoRequested);
}