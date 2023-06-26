//@ts-check

var gDocuments;

exports.init = ({
  documents
}) => {
  gDocuments = documents;
}

exports.getDocument = (req,res) => {
  if (!("id" in req.query)) {
    res.sendFile(__dirname + "/public/graphics/missing.png");
    return;
  }
  const id = req.query.id;

  gDocuments.getMainFileURI(id).then(data => {
    res.sendFile(data);
  }).catch(err => {
    if (err > 0) console.log(err); // don't worry about trivial problems, like "Document does not exist"
    res.sendFile(__dirname + "/public/graphics/missing.png");
  });
}