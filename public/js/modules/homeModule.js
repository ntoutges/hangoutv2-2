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
    this.el = document.createElement("div");
    this.el.classList.add("modules");
    
    this.title = document.createElement("h2");
    this.title.classList.add("module-titles");
    this.title.innerText = title;
    
    this.content = document.createElement("div");
    this.content.classList.add("module-contents");
    
    this.el.append(this.title);
    this.el.append(this.content);
  }
  appendTo(parentModule) {
    parentModule.appendModule(this);
  }
}

export class FriendsModule extends Module {
  constructor() {
    super("Friends");
    this.el.classList.add("friends");

    const container = document.createElement("div");
    this.confirmed = document.createElement("div");
    this.requests = document.createElement("div");
    this.requestLabel = document.createElement("h3");

    container.classList.add("flex");
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
  }
  addConfirmed(name) {
    const el = document.createElement("div");
    el.classList.add("friend-names");
    el.innerText = name;
    this.confirmed.append(el);
  }
  addRequested(name) {
    const el = document.createElement("div");
    const nameEl = document.createElement("span");
    const accept = document.createElement("img");
    el.

    el.classList.add("friend-names");
    el.innerHTML = name;
    this.requests.append(el);
  }
  set() {
    if (this.requests.children.length == 0) {
      this.requests.style.display = "none";
      this.requestLabel.style.display = "none";
      return;
    }
    else {
      this.requests.style.display = "";
      this.requestLabel.style.display = "";
    }
    if (this.confirmed.children.length == 0) this.confirmed.style.display = "none";
    else this.confirmed.style.display = "";
  }
}
