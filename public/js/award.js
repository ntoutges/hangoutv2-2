import { get, post } from "./modules/easyReq.js";

const $ = document.querySelector.bind(document);

$("#search").addEventListener("click", search)
$("#id").addEventListener("keydown", (e) => { if (e.keyCode == 13) { search(); } })

function search() {
  get("/profile", {
    id: $("#id").value
  }).then(([data,success]) => {
    if (!data._id) return;

    const awards = data.awards || [];
    get("/awards", {
      "awards": awards
    }).then(([data,success]) => {
      $("#user-awards").innerHTML = "";
      for (const award of data) {
        const opt = document.createElement("option");
        opt.setAttribute("value", award._id);
        opt.innerText = award.name;
        $("#user-awards").append(opt);
      }
    })
  })
}

$("#remove").addEventListener("click", () => {
  post("/removeAward", {
    "user": $("#id").value,
    "award": $("#user-awards").value
  }).then(([data,success]) => {
    console.log(data,success);
    search();
  });
});

$("#give").addEventListener("click", () => {
  post("/giveAward", {
    "user": $("#id").value,
    "award": $("#all-awards").value
  }).then(([data,success]) => {
    console.log(data,success);
    search();
  });
});

get("/allAwards").then(([data,success]) => {
  for (const award of data) {
    const opt = document.createElement("option");
    opt.setAttribute("value", award._id);
    opt.innerText = award.name;
    $("#all-awards").append(opt);
  }
})