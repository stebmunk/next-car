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
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f2f2f0" : "#09090b");
})();
