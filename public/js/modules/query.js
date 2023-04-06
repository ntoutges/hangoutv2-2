export class Query {
  constructor(search) {
    const parts = search.replace("?","").split("&");
    this.props = {};

    for (let part of parts) {
      const values = part.split("=");
      if (values.length == 1) this.props[decodeURIComponent(values[0])] = true; // treat as set
      else if (values.length >= 2) this.props[decodeURIComponent(values[0])] = decodeURIComponent(values[1]); // treat as map<key,value>, ignore anything else
    }
  }
  has(prop) { return prop in this.props; }
  remove(prop) { delete this.props[prop]; }
  get(prop, fallback=null) { return this.props[prop] ?? fallback; }
  set(prop, value) { this.props[prop] = value; }
  toString() {
    let queryStrings = [];
    for (let key in this.props) {
      queryStrings.push(`${encodeURIComponent(key)}=${encodeURIComponent(this.props[key])}`);
    }
    return queryStrings.join("&");
  }
}