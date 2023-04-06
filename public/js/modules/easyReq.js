export function post(path, data={}) {
  return new Promise((res) => {
    fetch(path,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    ).then((response) => {
      const success = (response.status == 200) ? "success" : (response.statusText + "#" + response.status);
      response.text().then((data) => {
        try { res([JSON.parse(data), success]); } // attempt to convert to JSON
        catch(err) { res([data, success]); } // if conversion fails, just send raw txt
      });
    });
  })
}

export function get(path, data={}) {
  let queryStrings = [];
  for (let key in data) {
    queryStrings.push(`${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`);
  }
  const queryString = queryStrings.join("&");
  return new Promise((res) => {
    fetch(
      (queryString.length == 0) ? path : (path + "?" + queryString),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      }
    ).then((response) => {
      const success = (response.status == 200) ? "success" : (response.statusText + "#" + response.status);
      response.text().then((data) => {
        try { res([JSON.parse(data), success]); } // attempt to convert to JSON
        catch(err) { res([data, success]); } // if conversion fails, just send raw txt
      });
    });
  })
}

export class HttpError {
  constructor(errStr) {
    this.err = errStr;

    const codeMatch = /\d+$/.exec(errStr);
    const msgMatch = /^.+(?=#)/.exec(errStr);

    this.code = codeMatch ? parseInt(codeMatch[0]) : 0;
    this.msg = msgMatch ? msgMatch[0].replace("Error: ", "") : "";
  }
}