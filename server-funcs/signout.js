//@ts-check

var gAccounts;
var gLogger;

exports.init = ({
  accounts,
  logger
}) => {
  gAccounts = accounts;
  gLogger = logger;
}

exports.getSignOut = (req,res) => {
  res.redirect("/");
  doLogout(req.session);
}

function doLogout(session) {
  gLogger.log(`[${session.user}] has logged out`)
  gAccounts.removeSession(session.user, session);
  session.destroy();
}
exports.doLogout = doLogout;