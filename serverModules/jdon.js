function toJSON(jdonStr) {
  const json = {};
  for (const line of jdonStr.replace(/\r/g, "").split("\n")) {
    const commentInfo = line.match(/((^)|( +))\/\/.*/); // comment structure -> "<spaces>//<.>"
    const commentIndex = commentInfo ? commentInfo.index : -1;
    if (commentIndex == 0) { continue; } // whole line comment, skippable

    const parseable = (commentIndex == -1) ? line : line.substring(0,commentIndex);

    const seperatorIndex = parseable.indexOf(":");
    if (seperatorIndex == -1) {
      if (parseable.length == 0) { continue; } // ignore empty lines
      json[parseable] = true; // treat as flag, not key/value pair
      continue;
    }
    const key = parseable.substring(0,seperatorIndex).trim();
    const value = parseable.substring(seperatorIndex+1).trim();
    json[key] = value;
  }
  return json;
}

function toJDON(json, prefix="") {
  let jdon = "";
  for (let key in json) {
    const value = json[key];

    if (value === false) { continue; } // not required
    if (value === true) {
      jdon += `${prefix + key}\n`;
      continue;
    }
    
    if (typeof value == "object") {
      jdon += toJDON(value,prefix + `${key}.`);
      continue;
    }
    jdon += `${prefix + key}:${value}\n`
  }
  return jdon;
}

exports.toJSON = toJSON;
exports.toJDON = toJDON;