(function () {
  var s = document.currentScript;
  var key = s && s.dataset.bot;
  if (!key) return;
  var origin = new URL(s.src).origin;
  var color = s.dataset.color || "#2563eb";
  var side = s.dataset.position === "left" ? "left" : "right";

  var btn = document.createElement("button");
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  btn.style.cssText = "position:fixed;bottom:20px;" + side + ":20px;width:56px;height:56px;" +
    "border-radius:50%;border:0;background:" + color + ";cursor:pointer;display:flex;" +
    "align-items:center;justify-content:center;z-index:2147483646;box-shadow:0 4px 12px rgba(0,0,0,.25)";

  var frame = document.createElement("iframe");
  frame.title = "Chat";
  frame.style.cssText = "position:fixed;bottom:90px;" + side + ":20px;width:380px;height:560px;" +
    "max-width:calc(100vw - 40px);max-height:calc(100vh - 110px);border:0;border-radius:12px;" +
    "box-shadow:0 8px 30px rgba(0,0,0,.25);z-index:2147483647;display:none;background:#fff";

  var open = false;
  function toggle(show) {
    open = show;
    if (open && !frame.src) frame.src = origin + "/embed/" + key; // lazy load
    frame.style.display = open ? "block" : "none";
  }
  btn.onclick = function () { toggle(!open); };

  window.addEventListener("message", function (e) {
    if (e.source === frame.contentWindow && e.data && e.data.type === "paperchat:close") toggle(false);
  });

  document.body.appendChild(frame);
  document.body.appendChild(btn);
})();