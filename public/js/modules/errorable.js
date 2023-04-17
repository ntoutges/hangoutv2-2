const $ = document.querySelector.bind(document);

var resolve = null;
var timeoutId = null;
export async function showMessage({
  title="Error",
  body="An error occured",
  button="ok",
  timeout=2000
}) {
  return new Promise((res) => {
    $("#background-blocker").classList.add("actives");
    $("#error-box").classList.add("actives");
    $("#error-title").innerText = title;
    $("#error-body").innerText = body;
    $("#error-button").innerText = button;

    $("#error-button").style.display = (button.length == "") ? "none" : "";

    $("#error-box").offsetWidth; // trigger CSS reflow
    $("#error-box").classList.add("animates");
    $("#background-blocker").classList.add("animates");

    $("#error-timeout").style.transitionDuration = "0ms";
    $("#error-timeout").style.width = "100%";
    const oldWidth = $("#error-timeout").offsetWidth; // also trigger reflow

    setTimeout(() => {
      $("#error-timeout").style.backgroundSize = `${oldWidth}px 100%`;
      $("#error-timeout").style.transitionDuration = `${timeout}ms`;
      $("#error-timeout").style.width = "0";
      resolve = res;

      if (timeout != 0) {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          hideMessage();
        }, timeout);
      }
    }, 200); // wait for animation to play before starting timers
  });
}

export async function hideMessage() {
  if (!resolve) return; // already hidden
  resolve();
  resolve = null;
  if (timeoutId != null) {
    clearInterval(timeoutId);
    timeoutId = null;
  }

  $("#error-box").classList.remove("animates");
  $("#background-blocker").classList.remove("animates");
  $("#error-timeout").style.width = window.getComputedStyle(document.getElementById("error-timeout")).getPropertyValue("width");
  setTimeout(() => {
    $("#background-blocker").classList.remove("actives");
    $("#error-box").classList.remove("actives");
  }, 300); // wait for animation to finish
}

$("#error-button").addEventListener("click", hideMessage);

export async function showError(err) {
  showMessage({
    title: "Error",
    body: err.toString(),
    timeout: 2500,
    button: "Ok."
  });
}