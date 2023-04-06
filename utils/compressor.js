class Key {
  constructor(forwardKeys) {
    this.com = forwardKeys; // forward direction = compression
    this.exp = {}; // backward direction = expansion
    for (let i in forwardKeys) { this.bac[forwardKeys[i]] = i; } // make hash map for reverse direction
  }

  compress(key) {
    if (!(key in this.com)) throw new Error(`Key [${key}] not available in compression direction`);
    return this.com[key];
  }
  expand(key) {
    if (!(key in this.exp)) throw new Error(`Key [${key}] not available in expansion direction`);
    return this.exp[key];
  }

  toString() { return JSON.stringify(this.com); } // only need forward direction to reconstruct backward direction
}

function generateKey(keys=[], validChars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  const forwardKeys = {};
  
  let keyInd = [-1];
  for (let i in keys) {
    keyInd[0]++;
    let keyChar = "";
    for (let j in keyInd) {
      if (keyInd[j] == validChars.length) {
        keyInd[j] = 0;
        if (keyInd.length == +j) keyInd.push(0); // need another counter to garuntee next line will work
        keyInd[+j+1]++;
      }
      keyChar += validChars[keyInd[j]];
    }
    forwardKeys[keys[i]] = keyChar;
  }

  return new Key(forwardKeys);
}

function compress(data, key) {
  let compressedData = {};
  for (let datum in data) {
    compressedData[key.compress(datum)] = data[datum];
  }
  return compressedData;
}

function expand(data, key) {
  let expandedData = {};
  for (let datum of data) {
    expandedData[key.expand(datum)] = data[datum];
  }
  return compressedData;
}