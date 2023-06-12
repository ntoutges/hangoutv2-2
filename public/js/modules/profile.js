export class Profile {
  constructor(data) {
    this._id = ("_id" in data) ? data._id : "";
    this.name = ("name" in data) ? data.name : "";
    this.biography = ("bio" in data) ? data.bio : "";
    this.awards = ("awards" in data) ? data.awards : [];
    this.sponsor = ("sponsor" in data) ? data.sponsor : ":root:";
    // this.password = ("pass" in data) ? data.pass : "";
    
    this.friends = {};
    if ("friends" in data) {
      this.friends.confirmed = ("confirmed" in data.friends) ? data.friends.confirmed : [];
      this.friends.requested = ("requested" in data.friends) ? data.friends.requested : [];
    }
    else {
      this.friends.confirmed = [];
      this.friends.requested = [];
    }
  }

  toObject() {
    var obj = {
      "_id": this._id,
      "name": this.name
    };
    if (this.biography != "") obj.bio = this.biography;
    if (this.friends.confirmed.length != 0 || this.friends.requested != 0) {
      obj.friends = {};
      if (this.friends.confirmed.length != 0) obj.friends.confirmed = this.friends.confirmed;
      if (this.friends.requested.length != 0) obj.friends.requested = this.friends.requested;
    }
    if (this.awards.length != 0) obj.awards = this.awards;
    if (this.sponsor != ":root:") obj.sponsor = this.sponsor;
    return obj;
  }
}