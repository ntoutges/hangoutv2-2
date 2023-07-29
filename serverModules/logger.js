var fs;
var txtLogsPath;
var htmlLogsPath;
var metaLogsPath;
var lastLogMS = 0;

exports.init = (lFs, path, localTxt, localHtml, localLastLog, callback=null) => {
  fs = lFs;
  txtLogsPath = path + "/" + localTxt;
  htmlLogsPath = path + "/" + localHtml;
  metaLogsPath = path + "/" + localLastLog;

  fs.readFile(metaLogsPath, "utf8", (err,data) => {
    if (err) log(`Unable to read \"${metaLogsPath}\"`);
    else lastLogMS = parseInt(data, 10) ?? 0;

    if (callback) callback();
  });
}

function log(...args) {
  for (const arg of args) {
    switch (typeof arg) {
      case "string":
        logStr(arg);
        break;
      case "number":
        logNum(arg);
        break;
      case "object":
        (Array.isArray(arg)) ? logArr(arg) : logObj(arg);
        break;
      default:
        logStr(arg);
        break;
    }
  }
  console.log.apply(console, args);
}

function logObj(obj) {
  logStr(JSON.stringify(obj));
}

function logArr(arr) {
  logStr("[" + arr.join(",") + "]");
}

function logStr(str) {
  const oldTimeObj = (new Date(lastLogMS));
  const timeObj = (new Date());
  
  const oldDate = (oldTimeObj.getMonth()+1) + "/" + (oldTimeObj.getDate()) + "/" + (oldTimeObj.getFullYear());
  const date = (timeObj.getMonth()+1) + "/" + (timeObj.getDate()) + "/" + (timeObj.getFullYear());
  const time = (timeObj.getHours().toString().padStart(2, "0")) + ":"
    + (timeObj.getMinutes().toString().padStart(2, "0")) + ":"
    + (timeObj.getSeconds().toString().padStart(2, "0")) + "."
    + (timeObj.getMilliseconds().toString().padStart(3, "0"));

  let finalStr = "";
  if (oldDate != date) {
    finalStr = "\n-- " + date + " --\n";
  }
  finalStr += time + ":  " + str + "\n";
  
  fs.appendFile(txtLogsPath, finalStr, (err) => {});
  fs.writeFile(metaLogsPath, timeObj.getTime().toString(), {}, err => {})
}

function logNum(num) {
  logStr("<" + num.toString() + ">");
}

exports.log = log;