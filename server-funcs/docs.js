//@ts-check

var gDocuments;
var gDirname;
var gLogger;

exports.init = ({
  documents,
  dirname,
  logger
}) => {
  gDocuments = documents;
  gDirname = dirname;
  gLogger = logger;
}

exports.getDocument = (req,res) => {
  if (!("id" in req.query)) {
    res.sendFile(gDirname + "/public/graphics/missing.png");
    return;
  }
  const id = req.query.id;
  
  gDocuments.getMainFileURI(id).then(data => {
    res.sendFile(data);
  }).catch(err => {
    if (err > 0) gLogger.log(err); // don't worry about trivial problems, like "Document does not exist"
    res.sendFile(gDirname + "/public/graphics/missing.png");
  });
}