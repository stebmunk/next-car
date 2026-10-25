(function () {
  var THEME_KEY = "next-car-theme";
  var MODEL_ORDER = ["i4", "model3", "ioniq5", "q6", "signia", "v60cc"];
  var MODEL_LABEL = {
    i4: "BMW i4",
    model3: "Model 3",
    ioniq5: "Ioniq 5",
    q6: "Q6 e-tron",
    signia: "Crown Signia",
    v60cc: "V60 Cross Country",
  };
  var FIT_RANK = {
    match: 0,
    "near-miss": 1,
    "over-cap": 2,
    unverified: 3,
    stale: 4,
    excluded: 5,
  };
  var TIMING_RANK = { "BUY NOW": 0, WATCH: 1, WAIT: 2 };
  var MOTIVATION_RANK = { High: 0, Medium: 1, Low: 2 };
  var FIT_LABEL = {
    match: "In the search",
    "near-miss": "Close",
    "over-cap": "Over the price line",
    unverified: "Unverified",
    stale: "Stale",
    excluded: "Set aside",
  };
  var FIT_CLASS = {
    match: "badge-match",
    "near-miss": "badge-near",
    "over-cap": "badge-over",
    unverified: "badge-wait",
    stale: "badge-aside",
    excluded: "badge-aside",
  };

  var state = readState();
  var cars = [];
  var goneEntries = [];

  var inventoryList = document.getElementById("inventory-list");
  var inventoryStatus = document.getElementById("inventory-status");
  var modelFilters = document.getElementById("model-filters");
  var viewFilters = document.getElementById("view-filters");
  var sortSelect = document.getElementById("sort");
  var goneList = document.getElementById("gone-list");
  var goneStatus = document.getElementById("gone-status");
  var goneFilters = document.getElementById("gone-filters");
  var comparableToggle = document.getElementById("comparable-only");

  initTheme();
  bindJumps();
  load();

  function load() {
    Promise.all([
      getJson("data/meta.json"),
      getJson("data/model3.json"),
      getJson("data/q6.json"),
      getJson("data/others.json"),
      getJson("data/gone.json"),
    ])
      .then(function (payloads) {
        var meta = payloads[0];
        applyMeta(meta);
        cars = []
          .concat(stamp(payloads[1]))
          .concat(stamp(payloads[2]))
          .concat(stamp(payloads[3]));
        goneEntries = (payloads[4].entries || []).slice();
        if (!knownModel(state.model)) state.model = "all";
        if (!knownModel(state.gone)) state.gone = "all";
        sortSelect.value = state.sort;
        render();
      })
      .catch(function () {
        inventoryStatus.textContent =
          "The listing files did not load. Open this page over HTTP, the way GitHub Pages serves it, so the browser can read the data folder.";
        goneStatus.textContent = "The off-market log did not load.";
      });
  }

  function stamp(pack) {
    return (pack.listings || []).map(function (car) {
      return {
        id: car.id,
        vin: car.vin || null,
        year: car.year,
        make: car.make,
        model: car.model,
        modelId: car.modelId,
        trim: car.trim || "",
        miles: car.miles,
        price: car.price,
        priceBasis: car.priceBasis || "vehicle",
        docFee: car.docFee,
        url: car.url,
        dealer: car.dealer,
        city: car.city,
        color: car.color,
        wheels: car.wheels,
        drivetrain: car.drivetrain,
        title: car.title || "unknown",
        cpo: Boolean(car.cpo),
        fit: car.fit || "unverified",
        statusNote: car.statusNote || "",
        priceHistory: Array.isArray(car.priceHistory) ? car.priceHistory : [],
        firstSeen: car.firstSeen,
        lastSeen: car.lastSeen,
        note: car.note || "",
        motivation: car.motivation || null,
        timing: car.timing || null,
        checked: pack.checked,
      };
    });
  }

  function applyMeta(meta) {
    var time = document.getElementById("updated");
    if (time && meta.lastUpdated) {
      time.dateTime = meta.lastUpdated;
      time.textContent = fullDate(meta.lastUpdated);
    }
    var summary = document.getElementById("updated-summary");
    if (summary && meta.summary) summary.textContent = meta.summary;
  }

  function render() {
    renderInventory();
    renderGone();
    writeState();
  }

  function renderInventory() {
    var modelCars = cars.filter(function (car) {
      return state.model === "all" || car.modelId === state.model;
    });
    var shown = modelCars.filter(passesView).sort(compareCars);
    var inPlay = modelCars.filter(inPlayFit).length;

    renderChips(modelFilters, modelChipDefs(cars, state.model), function (id) {
      state.model = id;
      render();
    });
    renderChips(viewFilters, viewChipDefs(modelCars), function (id) {
      state.view = id;
      render();
    });

    inventoryStatus.textContent =
      "Showing " +
      shown.length +
      " of " +
      modelCars.length +
      ". " +
      inPlay +
      " of those are in play.";

    if (!shown.length) {
      inventoryList.innerHTML = '<p class="callout">No cars match these filters.</p>';
      return;
    }

    var grouped = state.model === "all" && state.sort === "leads";
    var groups = grouped ? groupCars(shown) : [{ id: "flat", cars: shown }];
    inventoryList.innerHTML = groups
      .map(function (group) {
        var heading = grouped
          ? '<h3 class="group-label">' +
            esc(groupLabel(group.cars[0])) +
            "<span>" +
            group.cars.length +
            "</span></h3>"
          : "";
        return (
          '<section class="model-group">' +
          heading +
          '<div class="car-list">' +
          group.cars.map(carCard).join("") +
          "</div></section>"
        );
      })
      .join("");
  }

  function renderGone() {
    var pool = goneEntries.filter(function (entry) {
      if (state.gone !== "all" && entry.modelId !== state.gone) return false;
      if (state.comparable && !entry.comparable) return false;
      return true;
    });
    pool.sort(function (a, b) {
      return String(b.lastSeen).localeCompare(String(a.lastSeen));
    });

    var models = uniqueModels(goneEntries);
    var chips = [{ id: "all", label: "All " + goneEntries.length, pressed: state.gone === "all" }].concat(
      models.map(function (id) {
        var count = goneEntries.filter(function (entry) {
          return entry.modelId === id;
        }).length;
        return {
          id: id,
          label: (MODEL_LABEL[id] || id) + " " + count,
          pressed: state.gone === id,
        };
      })
    );
    renderChips(goneFilters, chips, function (id) {
      state.gone = id;
      render();
    });
    comparableToggle.setAttribute("aria-pressed", state.comparable ? "true" : "false");

    var comparableCount = goneEntries.filter(function (entry) {
      return entry.comparable;
    }).length;
    goneStatus.textContent =
      "Showing " +
      pool.length +
      " of " +
      goneEntries.length +
      ". " +
      comparableCount +
      " met the search before they left.";

    goneList.innerHTML = pool.length
      ? pool.map(goneCard).join("")
      : '<p class="callout">Nothing in the log matches these filters.</p>';
  }

  function carCard(car) {
    var href = safeUrl(car.url);
    var name = [car.year, car.make, car.model].filter(Boolean).join(" ");
    var titleHtml = href
      ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + "</a>"
      : esc(name);
    var badges = [
      '<span class="badge ' + (FIT_CLASS[car.fit] || "badge-aside") + '">' + esc(FIT_LABEL[car.fit] || car.fit) + "</span>",
    ];
    if (car.cpo) badges.push('<span class="badge badge-title">CPO</span>');
    if (car.title === "clean") badges.push('<span class="badge badge-title">Clean title</span>');
    if (car.title === "branded") badges.push('<span class="badge badge-aside">Branded title</span>');
    if (car.title === "buyback") badges.push('<span class="badge badge-aside">Buyback title</span>');

    var calls = "";
    if (car.motivation && car.motivation.score) {
      calls +=
        '<span class="badge ' +
        motivationClass(car.motivation.score) +
        '">' +
        esc(car.motivation.score) +
        " motivation</span>";
    }
    if (car.timing && car.timing.call) {
      calls +=
        '<span class="badge ' +
        timingClass(car.timing.call) +
        '">' +
        esc(car.timing.call) +
        "</span>";
    }

    var reasons = "";
    if (car.motivation && car.motivation.reason) {
      reasons += "<p class=\"reason\"><strong>Motivation.</strong> " + esc(car.motivation.reason) + "</p>";
    }
    if (car.timing && car.timing.reason) {
      reasons += "<p class=\"reason\"><strong>Timing.</strong> " + esc(car.timing.reason) + "</p>";
    }

    var where = [car.dealer, car.city, miles(car.miles), car.color, car.wheels]
      .filter(Boolean)
      .join(" · ");
    var seen = seenLine(car);
    var series = historyFor(car);
    var change = deltaLine(series);
    var fee = feeLine(car);
    var details = detailsBlock(car);

    return (
      '<article class="car fit-' +
      esc(car.fit) +
      '" id="listing-' +
      esc(car.id) +
      '">' +
      '<div class="car-main">' +
      '<div class="kicker">' +
      badges.join("") +
      "</div>" +
      "<h3>" +
      titleHtml +
      "</h3>" +
      '<p class="trim">' +
      esc(trimLine(car)) +
      "</p>" +
      '<p class="where">' +
      esc(where) +
      "</p>" +
      (car.statusNote ? '<p class="status-note">' + esc(car.statusNote) + "</p>" : "") +
      (calls ? '<div class="calls">' + calls + "</div>" : "") +
      reasons +
      (seen ? '<p class="seen">' + esc(seen) + "</p>" : "") +
      details +
      "</div>" +
      '<div class="car-price">' +
      '<p class="price">' +
      (car.price == null ? "Price not listed" : esc(money(car.price))) +
      "</p>" +
      (change.text ? '<p class="delta ' + change.tone + '">' + esc(change.text) + "</p>" : "") +
      sparkline(series) +
      (fee ? '<p class="fee">' + esc(fee) + "</p>" : "") +
      (href
        ? '<a class="listing-link" href="' +
          esc(href) +
          '" target="_blank" rel="noopener noreferrer">View listing</a>'
        : "") +
      "</div></article>"
    );
  }

  function goneCard(entry) {
    var href = safeUrl(entry.url);
    var name = [entry.year, entry.make, entry.model].filter(Boolean).join(" ");
    var titleHtml = href
      ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + "</a>"
      : esc(name);
    var where = [entry.trim, entry.dealer, entry.city, entry.miles == null ? "" : miles(entry.miles)]
      .filter(Boolean)
      .join(" · ");
    var prices = pricePath(entry);
    var days = entry.daysListed === 0 ? "Same day" : entry.daysListed + " days observed";
    var cuts =
      entry.priceCuts === 1 ? "1 price cut" : entry.priceCuts ? entry.priceCuts + " price cuts" : "No price cut";
    var badge = entry.comparable
      ? '<span class="badge badge-match">Comparable</span>'
      : '<span class="badge badge-aside">Outside the search</span>';
    if (entry.title === "buyback") badge += '<span class="badge badge-aside">Buyback title</span>';
    if (entry.title === "branded") badge += '<span class="badge badge-aside">Branded title</span>';

    return (
      '<article class="gone-card" id="gone-' +
      esc(entry.id) +
      '">' +
      '<div class="gone-top">' +
      "<div>" +
      '<div class="kicker">' +
      badge +
      "</div>" +
      "<h3>" +
      titleHtml +
      "</h3>" +
      '<p class="where">' +
      esc(where) +
      "</p>" +
      "</div>" +
      '<div class="price-stack">' +
      '<p class="gone-price">' +
      esc([prices, cuts, days].filter(Boolean).join(" · ")) +
      "</p>" +
      '<p class="seen">' +
      esc(shortDate(entry.firstSeen) + " – " + shortDate(entry.lastSeen)) +
      "</p>" +
      "</div></div>" +
      (entry.outcome ? '<p class="outcome">' + esc(sentence(entry.outcome)) + "</p>" : "") +
      (href
        ? '<a class="listing-link" href="' +
          esc(href) +
          '" target="_blank" rel="noopener noreferrer">View listing</a>'
        : "") +
      "</article>"
    );
  }

  function detailsBlock(car) {
    var bits = [];
    if (car.vin) bits.push("<p class=\"vin\">VIN " + esc(car.vin) + "</p>");
    if (car.note) bits.push("<p>" + esc(car.note) + "</p>");
    if (!bits.length) return "";
    return "<details class=\"details\"><summary>Details</summary>" + bits.join("") + "</details>";
  }

  function trimLine(car) {
    var trim = car.trim || "";
    if (/awd|rwd|quattro|xdrive/i.test(trim)) return trim;
    return [trim, car.drivetrain].filter(Boolean).join(" · ");
  }

  function seenLine(car) {
    if (!car.firstSeen && !car.lastSeen) return "";
    var range = shortDate(car.firstSeen);
    if (car.lastSeen && car.lastSeen !== car.firstSeen) {
      range += " – " + shortDate(car.lastSeen);
    }
    var fresh = !car.checked || car.lastSeen === car.checked;
    return (fresh ? "Seen " : "Last seen ") + range;
  }

  function feeLine(car) {
    if (car.priceBasis === "with-fees") return "Includes listed fees";
    if (car.priceBasis === "with-shipping") return "Includes shipping";
    if (car.docFee) return "Doc fee " + money(car.docFee);
    return "";
  }

  function pricePath(entry) {
    if (entry.firstPrice == null && entry.lastPrice == null) return "Price not listed";
    if (entry.firstPrice == null) return money(entry.lastPrice);
    if (entry.lastPrice == null || entry.firstPrice === entry.lastPrice) return money(entry.firstPrice);
    return money(entry.firstPrice) + " → " + money(entry.lastPrice);
  }

  function passesView(car) {
    if (state.view === "in-play") return inPlayFit(car);
    if (state.view === "aside") return !inPlayFit(car);
    return true;
  }

  function inPlayFit(car) {
    return car.fit === "match" || car.fit === "near-miss" || car.fit === "over-cap" || car.fit === "unverified";
  }

  function compareCars(a, b) {
    if (state.sort === "price") {
      return (a.price == null ? Infinity : a.price) - (b.price == null ? Infinity : b.price);
    }
    if (state.sort === "newest") {
      return String(b.lastSeen || "").localeCompare(String(a.lastSeen || ""));
    }
    var fit = (FIT_RANK[a.fit] ?? 9) - (FIT_RANK[b.fit] ?? 9);
    if (fit) return fit;
    var timing =
      (TIMING_RANK[a.timing && a.timing.call] ?? 9) - (TIMING_RANK[b.timing && b.timing.call] ?? 9);
    if (timing) return timing;
    var motivation =
      (MOTIVATION_RANK[a.motivation && a.motivation.score] ?? 9) -
      (MOTIVATION_RANK[b.motivation && b.motivation.score] ?? 9);
    if (motivation) return motivation;
    return (a.price == null ? Infinity : a.price) - (b.price == null ? Infinity : b.price);
  }

  function groupCars(list) {
    var map = {};
    list.forEach(function (car) {
      if (!map[car.modelId]) map[car.modelId] = [];
      map[car.modelId].push(car);
    });
    var ids = Object.keys(map).sort(function (a, b) {
      var ai = MODEL_ORDER.indexOf(a);
      var bi = MODEL_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return ids.map(function (id) {
      return { id: id, cars: map[id] };
    });
  }

  function groupLabel(car) {
    return [car.make, car.model].filter(Boolean).join(" ");
  }

  function modelChipDefs(list, active) {
    var ids = uniqueModels(list);
    return [{ id: "all", label: "All " + list.length, pressed: active === "all" }].concat(
      ids.map(function (id) {
        var count = list.filter(function (car) {
          return car.modelId === id;
        }).length;
        return {
          id: id,
          label: (MODEL_LABEL[id] || id) + " " + count,
          pressed: active === id,
        };
      })
    );
  }

  function viewChipDefs(list) {
    var inPlay = list.filter(inPlayFit).length;
    return [
      { id: "all", label: "All", pressed: state.view === "all" },
      { id: "in-play", label: "In play " + inPlay, pressed: state.view === "in-play" },
      { id: "aside", label: "Set aside " + (list.length - inPlay), pressed: state.view === "aside" },
    ];
  }

  function uniqueModels(list) {
    var seen = {};
    list.forEach(function (item) {
      seen[item.modelId] = true;
    });
    return Object.keys(seen).sort(function (a, b) {
      var ai = MODEL_ORDER.indexOf(a);
      var bi = MODEL_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  function renderChips(container, defs, onPick) {
    var focused = container.querySelector(".chip:focus");
    var focusedId = focused ? focused.getAttribute("data-id") : "";
    container.innerHTML = defs
      .map(function (def) {
        return (
          '<button type="button" class="chip" data-id="' +
          esc(def.id) +
          '" aria-pressed="' +
          (def.pressed ? "true" : "false") +
          '">' +
          esc(def.label) +
          "</button>"
        );
      })
      .join("");
    Array.prototype.forEach.call(container.querySelectorAll(".chip"), function (button) {
      button.addEventListener("click", function () {
        onPick(button.getAttribute("data-id"));
      });
    });
    if (focusedId) {
      var again = container.querySelector('[data-id="' + focusedId + '"]');
      if (again) again.focus();
    }
  }

  function historyFor(car) {
    if (car.priceHistory.length) return car.priceHistory;
    if (car.price == null) return [];
    return [{ date: car.lastSeen || car.firstSeen || car.checked, price: car.price }];
  }

  function deltaLine(history) {
    var points = (history || []).filter(function (point) {
      return point && point.price != null;
    });
    if (!points.length) return { text: "", tone: "flat" };
    if (points.length === 1) return { text: "One check", tone: "flat" };
    var delta = points[points.length - 1].price - points[0].price;
    if (delta === 0) return { text: "Unchanged", tone: "flat" };
    var tone = delta < 0 ? "drop" : "rise";
    var sign = delta < 0 ? "−" : "+";
    return { text: sign + money(Math.abs(delta)) + " from " + shortDate(points[0].date), tone: tone };
  }

  function sparkline(history) {
    var points = (history || []).filter(function (point) {
      return point && point.price != null;
    });
    if (!points.length) return "";
    var width = 132;
    var height = 40;
    var pad = 3;
    var prices = points.map(function (point) {
      return point.price;
    });
    var min = Math.min.apply(null, prices);
    var max = Math.max.apply(null, prices);
    var span = max - min;
    var coords = points.map(function (point, index) {
      var x = points.length === 1 ? width / 2 : pad + (index / (points.length - 1)) * (width - pad * 2);
      var y = span === 0 ? height / 2 : pad + (1 - (point.price - min) / span) * (height - pad * 2);
      return [round(x), round(y)];
    });
    var first = points[0];
    var last = points[points.length - 1];
    var tone = last.price < first.price ? "drop" : last.price > first.price ? "rise" : "flat";
    var label =
      points.length === 1
        ? "One recorded price, " + money(first.price) + " on " + shortDate(first.date)
        : "Price from " +
          money(first.price) +
          " on " +
          shortDate(first.date) +
          " to " +
          money(last.price) +
          " on " +
          shortDate(last.date);
    var end = coords[coords.length - 1];
    return (
      '<svg class="spark spark-' +
      tone +
      '" viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="' +
      esc(label) +
      '"><polyline points="' +
      coords
        .map(function (pair) {
          return pair.join(",");
        })
        .join(" ") +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline><circle cx="' +
      end[0] +
      '" cy="' +
      end[1] +
      '" r="2.6" fill="currentColor"></circle></svg>'
    );
  }

  function motivationClass(score) {
    if (score === "High") return "badge-high";
    if (score === "Medium") return "badge-medium";
    return "badge-low";
  }

  function timingClass(call) {
    if (call === "BUY NOW") return "badge-buy";
    if (call === "WATCH") return "badge-watch";
    return "badge-wait";
  }

  function knownModel(id) {
    if (!id || id === "all") return true;
    return cars.some(function (car) {
      return car.modelId === id;
    }) || goneEntries.some(function (entry) {
      return entry.modelId === id;
    });
  }

  function readState() {
    var params = new URLSearchParams(window.location.search);
    var view = params.get("view");
    var sort = params.get("sort");
    return {
      model: params.get("model") || "all",
      view: view === "in-play" || view === "aside" ? view : "all",
      sort: sort === "price" || sort === "newest" ? sort : "leads",
      gone: params.get("gone") || "all",
      comparable: params.get("comparable") === "1",
    };
  }

  function writeState() {
    var url = new URL(window.location.href);
    url.search = "";
    if (state.model !== "all") url.searchParams.set("model", state.model);
    if (state.view !== "all") url.searchParams.set("view", state.view);
    if (state.sort !== "leads") url.searchParams.set("sort", state.sort);
    if (state.gone !== "all") url.searchParams.set("gone", state.gone);
    if (state.comparable) url.searchParams.set("comparable", "1");
    if (!writeState.armed) {
      writeState.armed = true;
      if (url.href !== window.location.href) window.history.replaceState(null, "", url);
      return;
    }
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
  }

  window.addEventListener("popstate", function () {
    state = readState();
    if (sortSelect) sortSelect.value = state.sort;
    renderInventory();
    renderGone();
  });

  function bindJumps() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest("[data-jump-model]");
      if (!link || !cars.length) return;
      event.preventDefault();
      var url = new URL(window.location.href);
      url.hash = "available";
      window.history.replaceState(null, "", url);
      state.model = link.getAttribute("data-jump-model");
      state.view = "all";
      render();
      var section = document.getElementById("available");
      if (section) {
        var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
    });
  }

  function initTheme() {
    var button = document.getElementById("theme-toggle");
    var media = window.matchMedia("(prefers-color-scheme: light)");
    syncThemeButton();
    button.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (err) {
        /* Storage can be blocked. The theme still applies for this view. */
      }
      syncThemeButton();
    });
    media.addEventListener("change", function (event) {
      var saved = "";
      try {
        saved = localStorage.getItem(THEME_KEY) || "";
      } catch (err) {
        saved = "";
      }
      if (saved === "light" || saved === "dark") return;
      document.documentElement.setAttribute("data-theme", event.matches ? "light" : "dark");
      syncThemeButton();
    });
    sortSelect.addEventListener("change", function () {
      state.sort = sortSelect.value;
      render();
    });
    comparableToggle.addEventListener("click", function () {
      state.comparable = comparableToggle.getAttribute("aria-pressed") !== "true";
      render();
    });
  }

  function syncThemeButton() {
    var button = document.getElementById("theme-toggle");
    var theme = document.documentElement.getAttribute("data-theme") || "dark";
    var toLight = theme !== "light";
    button.textContent = toLight ? "Day" : "Night";
    button.setAttribute("aria-label", toLight ? "Switch to day theme" : "Switch to night theme");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f2f2f0" : "#09090b");
  }

  function getJson(path) {
    return fetch(path).then(function (response) {
      if (!response.ok) throw new Error(path);
      return response.json();
    });
  }

  function money(value) {
    return Number(value).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }

  function miles(value) {
    return Number(value).toLocaleString("en-US") + " mi";
  }

  function shortDate(iso) {
    if (!iso) return "";
    var parts = String(iso).split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  function fullDate(iso) {
    var parts = String(iso).split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function sentence(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function round(value) {
    return Math.round(value * 10) / 10;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      var url = new URL(value, window.location.href);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      return url.href;
    } catch (err) {
      return "";
    }
  }
})();
