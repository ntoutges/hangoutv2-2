import { lFill } from "./format.js";

const $ = document.querySelector.bind(document);

export class Post {
  constructor(data) {
    this.title = ("q" in data) ? data.q : "////";
    this.text = ("t" in data) ? data.t : "////";
    this.published = ("p" in data) ? new Date(data.p) : new Date();
    this.formatting = ("f" in data) ? data.f : [];
    this.user = ("u" in data) ? data.u : "???";

    this.blocks = [];
    let i = 0;
    for (let format of this.formatting) {
      this.blocks.push(this.text.slice(i,i+format.w));
      i += format.w;
    }
    if (i < this.text.length) this.blocks.push(this.text.slice(i,this.text.length));

    this.header = document.createElement("div");
    this.header.classList.add("headers")
    
    const title = document.createElement("h3");
    title.classList.add("titles");
    title.innerText = this.title;
    this.header.append(title);

    this.footer = document.createElement("div");
    this.footer.classList.add("footers");
    const p = this.published;
    
    const publishedDate = document.createElement("div");
    publishedDate.classList.add("published-dates");
    publishedDate.innerText = `${p.getMonth()+1}/${p.getDate()}/${p.getFullYear()}`;
    
    const publishedTime = document.createElement("div");
    publishedTime.classList.add("published-times");
    publishedTime.innerText = `${lFill(p.getHours(),"0")}:${lFill(p.getMinutes(),"0")}`;
    
    const username = document.createElement("div");
    username.classList.add("usernames");
    username.innerText = this.user;
    
    this.footer.append(publishedDate);
    this.footer.append(publishedTime);
    this.footer.append(username);


    this.message = document.createElement("div");
    this.message.classList.add("texts");
    for (let i in this.blocks) {
      const block = this.blocks[i];
      const lines = block.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length != 0) {
          const lineEl = document.createElement("p");
          lineEl.classList.add("lines");
          if (i == 0 || i == lines.length-1) lineEl.style.display = "inline";
          lineEl.innerText = lines[i];
          this.message.append(lineEl);
        }
        if (i != lines.length-1) this.message.append(document.createElement("br"));
      }
    }

    this.el = document.createElement("div");
    this.el.classList.add("posts");
    this.el.append(this.header);
    this.el.append(this.message);
    this.el.append(this.footer);
  }
  appendTo(other) { other.append(this.el); }
}
