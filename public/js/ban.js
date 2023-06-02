import { get, post } from "./modules/easyReq.js";

const $ = document.querySelector.bind(document);

$("#search").addEventListener("click", search)
$("#id").addEventListener("keydown", (e) => { if (e.keyCode == 13) { search(); } })

function search() {
  get("/profile", {
    id: $("#id").value
  }).then(([data,success]) => {
    if (!data._id) return;

    const bans = data.bans || [];
    $("#ban-reasons").innerHTML = "";
    for (const ban of bans) {
      const opt = document.createElement("option");
      opt.setAttribute("value", ban);
      opt.innerText = ban;
      $("#ban-reasons").append(opt);
    }
    updateType();
  })
}

$("#ban").addEventListener("click", () => {
  post("/banUser", {
    user: $("#id").value,
    types: $("#type").value
  }).then(([data,success]) => {
    console.log(data,success);
    search();
  })
})

$("#unban").addEventListener("click", () => {
  post("/unbanUser", {
    banId: $("#ban-reasons").value
  }).then(([data,success]) => {
    console.log(data,success);
    search();
  })
})

$("#ban-reasons").addEventListener("change", updateType);

function updateType() {
  get("/banStatus", {
    banId: $("#ban-reasons").value
  }).then(([data,success]) => {
    $("#type").value = data;
  }).catch(err => { console.log(err); });
}