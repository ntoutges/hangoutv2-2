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
  let queryString = "";
  for (let key in data) {
    queryString += `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`;
  }
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
