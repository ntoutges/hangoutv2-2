//@ts-check

var gAccounts;

exports.init = ({
  accounts
}) => {
  gAccounts = accounts;
}

exports.getSignOut = (req,res) => {
  res.redirect("/");
  doLogout(req.session);
}

function doLogout(session) {
  gAccounts.removeSession(session.user, session);
  session.destroy();
}
exports.doLogout = doLogout;