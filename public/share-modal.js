/* Loaded by some cached HTML; must not assume DOM nodes exist. */
(function () {
  "use strict";

  function shareFunction(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    var url = window.location.href;
    if (navigator.share) {
      navigator
        .share({ title: document.title, url: url })
        .catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(function () {});
    }
  }

  const shareButton = document.getElementById("shareButton");
  if (shareButton) {
    shareButton.addEventListener("click", shareFunction);
  }
})();
