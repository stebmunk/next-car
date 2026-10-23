(function () {
  var key = "next-car-theme";
  var theme = "dark";
  try {
    var saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") {
      theme = saved;
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      theme = "light";
    }
  } catch (err) {
    theme = "dark";
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
