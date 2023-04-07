export class ParentModule {
  constructor(parent) {
    this.columns = [];
    this.borders = [];
    this.el = document.createElement("div");
    this.el.classList.add("parent-modules");
    parent.appendChild(this.el);
  }
  appendModule(module, rowI=0,columnI=0) {
    // ensure the correct amount of columns exists
    for (let i = this.columns.length; i <= rowI; i++) {
      if (i != 0) {
        const border = document.createElement("div");
        border.classList.add("h-borders");
        border.classList.add("borders");
        this.borders.push(border);
        this.el.append(border);
      }
      this.columns.push( new Column(this.el) );
    }
    this.columns[rowI].appendModule(module, columnI);
  }
}

export class Column {
  constructor(parent) {
    this.modules = [];
    this.borders = [];
    this.el = document.createElement("div");
    this.el.classList.add("column-modules");
    parent.appendChild(this.el);
  }
  appendModule(module, index) {
    index = Math.min(index, this.modules.length)
    this.modules.splice(index,0,module);
    if (index != this.modules.length-1) this.el.insertBefore(module.el, this.modules[index+1].el);
    else this.el.appendChild(module.el);

    if (this.modules.length != 1) {
      const border = document.createElement("div");
      border.classList.add("v-borders");
      border.classList.add("borders");
      this.borders.push(border);
      this.el.insertBefore(border, this.modules[(index == 0) ? 1 : index].el);
    }
  }
}

export class Module {
  constructor(
    title="Module!"
  ) {
    this.listeners = {};

    this.el = document.createElement("div");
    this.el.classList.add("modules");
    
    if (title.length != 0) {
      this.title = document.createElement("h2");
      this.title.classList.add("module-titles");
      this.title.innerText = title;
      this.el.append(this.title);
    }
    
    this.content = document.createElement("div");
    this.content.classList.add("module-contents");
    
    this.el.append(this.content);
  }
  appendTo(parentModule) {
    parentModule.appendModule(this);
  }

  on(event, callback) {
    if (event in this.listeners) this.listeners[event].push(callback);
  }
}

export class FriendsModule extends Module {
  constructor(editable=true) {
    super("Friends");
    this.el.classList.add("friends");
    this.listeners = {
      "accept": [],
      "reject": [],
      "remove": []
    };
    this.els = {
      "requested": {},
      "confirmed": {}
    }

    this.editable = editable;

    const container = document.createElement("div");
    this.confirmed = document.createElement("div");
    this.requests = document.createElement("div");
    this.requestLabel = document.createElement("h3");

    container.classList.add("flex");
    container.classList.add("friend-containers");
    this.confirmed.classList.add("friend-holders");
    this.confirmed.classList.add("friend-confirm-holders");
    this.requests.classList.add("friend-holders");
    this.requests.classList.add("friend-request-holders");
    this.requestLabel.classList.add("request-labels")
    this.requestLabel.innerText = "Requests"

    this.content.append(container);
    container.append(this.confirmed);
    container.append(this.requests);
    this.content.append(this.requestLabel);

    this.noFriends = document.createElement("p");
    this.noFriends.classList.add("no-friends");
    this.noFriends.classList.add("inactives")
    this.noFriends.innerText = `${editable?"You":"This account"} currently ${editable?"have":"has"} no friends.`;

    this.content.append(this.noFriends);
  }
  addConfirmed(name) {
    if (name in this.els.confirmed) return;
    const el = document.createElement("div");
    const nameEl = document.createElement("span")
    const remove = document.createElement("img");

    nameEl.innerText = name;
    
    el.classList.add("friend-names");
    el.append(nameEl);
    this.confirmed.append(el);
    this.els.confirmed[name] = el;
    
    if (this.editable) {
      remove.setAttribute("src", "graphics/reject.png");
      remove.classList.add("friend-rejectors");
      remove.setAttribute("title", "Remove friend");
      remove.addEventListener("click", this.onRemove.bind(this, name,el));
      
      el.append(remove);
    }
  }
  addRequested(name, transaction) {
    if (name in this.els.requested) return;
    const el = document.createElement("div");
    const nameEl = document.createElement("span");
    const accept = document.createElement("img");
    const reject = document.createElement("img");

    nameEl.innerText = name;
    
    el.classList.add("friend-names");
    el.append(nameEl);
    this.requests.append(el);
    
    if (this.editable) {
      const transactionId = transaction._id;
      const acceptable = transaction.data.from == name;
      if (acceptable) {
        accept.setAttribute("src", "graphics/accept.png");
        accept.classList.add("friend-acceptors");
        accept.setAttribute("title", "Accept request");
        accept.addEventListener("click", this.onAccept.bind(this, name,transactionId,el));
        el.append(accept);
      }

      reject.setAttribute("src", "graphics/reject.png");
      reject.classList.add("friend-rejectors");
      reject.setAttribute("title", "Reject request");
      reject.addEventListener("click", this.onReject.bind(this, name,transactionId,el));
      
      el.append(reject);
      this.els.requested[name] = el;
    }
  }
  popConfirmed(name) {
    if (!(name in this.els.confirmed)) return; 
    this.els.confirmed[name].remove();
    delete this.els.confirmed[name];
  }
  popRequested(name) {
    if (!(name in this.els.requested)) return;
    this.els.requested[name].remove(); 
    delete this.els.requested[name];
  }
  set() {
    // requested friends
    if (this.requests.children.length == 0) {
      this.requests.style.display = "none";
      this.requestLabel.style.display = "none";
    }
    else {
      this.requests.style.display = "";
      this.requestLabel.style.display = "";
    }

    // friends
    if (this.confirmed.children.length == 0) this.confirmed.style.display = "none";
    else this.confirmed.style.display = "";
    
    // only one box has data in it (font size can be increased thusly)
    if ((this.confirmed.children.length == 0) ^ (this.requests.children.length == 0)) {
      this.confirmed.style.fontSize = "2.3vh";
      this.requests.style.fontSize = "2.3vh";
    }
    else {
      this.confirmed.style.fontSize = "";
      this.requests.style.fontSize = "";
    }

    // neigher box has data in it (display message to allay confusion)
    if ((this.confirmed.children.length == 0) && (this.requests.children.length == 0)) {
      this.content.querySelector(".friend-containers").classList.add("inactives");
      this.noFriends.classList.remove("inactives");
    }
    else {
      this.content.querySelector(".friend-containers").classList.remove("inactives");
      this.noFriends.classList.add("inactives");
    }
  }
  onAccept(name,transactionId, el) {
    el.remove();
    this.addConfirmed(name);
    this.set();
    this.listeners.accept.forEach((callback) => { callback.call(this,transactionId); });
  }
  onReject(name,transactionId, el) {
    el.remove();
    this.set();
    this.listeners.reject.forEach((callback) => { callback.call(this,transactionId); });
  }
  onRemove(name,el) {
    el.remove();
    this.set();
    this.listeners.remove.forEach((callback) => { callback.call(this,name); });
  }
}

export class FriendsRequestModule extends Module {
  constructor(mode="unrelated") {
    super("");
    this.listeners = {
      "click": []
    };
    this.mode = mode;
    this.request = null;

    this.el.classList.add("friends-requests")
    this.content.classList.add("no-titles");
  }
  set() {
    if (this.request) this.request.remove();
    switch (this.mode) {
      case "requested":
        this.request = document.createElement("div");
        this.request.innerText = "Friend Request Sent";
        this.request.classList.add("friends-requested-buttons");
        break;
      case "friends":
        this.request = document.createElement("div");
        this.request.innerText = "Friends";
        this.request.classList.add("friends-requested-buttons");
        break;
      case "loading":
        this.request = document.createElement("div");
        this.request.innerText = "loading";
        this.request.classList.add("friends-requested-buttons");
        this.request.classList.add("loadings");
        break;
      case "sending":
        this.request = document.createElement("div");
        this.request.innerText = "sending request";
        this.request.classList.add("friends-requested-buttons");
        this.request.classList.add("loadings");
        break;
      default:
      // case "unrelated":
        this.request = document.createElement("button");
        this.request.innerText = "Send Friend Request";
        this.request.classList.add("friends-request-buttons");
        this.request.addEventListener("click", this.onClick.bind(this));
        break;
    }
    this.content.append(this.request);
  }
  onClick() {
    this.listeners.click.forEach((callback) => { callback.call(this); });
  }
}