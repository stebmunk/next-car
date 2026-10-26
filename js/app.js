(function () {
  var THEME_KEY = "next-car-theme";
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
  var STATUSES = { "front-runner": 1, considering: 1, dropped: 1 };
  var TRENDS = { gaining: 1, steady: 1, fading: 1 };

  var state = readState();
  var rules = { ceiling: 25000, hideAbove: 27000 };
  var cars = [];
  var goneEntries = [];
  var models = [];
  var priorities = { asOf: "", items: [], previously: [] };
  var reference = [];
  var costNote = "";
  var urlReady = false;

  var runnerTabs = document.getElementById("runner-tabs");
  var runnerGrid = document.getElementById("runner-grid");
  var contenderList = document.getElementById("contender-list");
  var droppedEl = document.getElementById("dropped");
  var priorityStrip = document.getElementById("priorities");
  var goneList = document.getElementById("gone-list");
  var goneStatus = document.getElementById("gone-status");
  var goneFilters = document.getElementById("gone-filters");
  var goneMeta = document.getElementById("gone-meta");
  var goneIntro = document.getElementById("gone-intro");
  var milesAside = document.getElementById("miles-aside");
  var comparableToggle = document.getElementById("comparable-only");

  initTheme();
  bind();
  load();

  function load() {
    Promise.all([
      getJson("data/meta.json"),
      getJson("data/model3.json"),
      getJson("data/q6.json"),
      getJson("data/others.json"),
      getJson("data/gone.json"),
      getJson("data/models.json").catch(function () {
        return null;
      }),
    ])
      .then(function (payloads) {
        applyMeta(payloads[0]);
        cars = []
          .concat(stamp(payloads[1]))
          .concat(stamp(payloads[2]))
          .concat(stamp(payloads[3]));
        goneEntries = (payloads[4] && payloads[4].entries) || [];
        applyBoard(payloads[5]);
        renderAll();
        urlReady = true;
        openDeepLink();
      })
      .catch(function () {
        runnerGrid.innerHTML =
          '<p class="callout">The listing files did not load. Open this page over HTTP, the way GitHub Pages serves it, so the browser can read the data folder.</p>';
        if (goneStatus) goneStatus.textContent = "The off-market log did not load.";
      });
  }

  function stamp(pack) {
    return ((pack && pack.listings) || []).map(function (car) {
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
        mileageException: car.mileageException === true,
        mileageExceptionReason:
          typeof car.mileageExceptionReason === "string" ? car.mileageExceptionReason : "",
        checked: pack.checked,
      };
    });
  }

  function applyMeta(meta) {
    var time = document.getElementById("updated");
    if (time && meta && meta.lastUpdated) {
      time.dateTime = meta.lastUpdated;
      time.textContent = fullDate(meta.lastUpdated);
    }
    var summary = document.getElementById("updated-summary");
    if (summary && meta && meta.summary) summary.textContent = meta.summary;
  }

  function applyBoard(board) {
    var source = board && typeof board === "object" ? board : fallbackBoard();
    var criteria = source.criteria || {};
    rules.ceiling = positive(criteria.milesCeiling, 25000);
    rules.hideAbove = positive(criteria.hideAbove, 27000);
    if (rules.hideAbove < rules.ceiling) rules.hideAbove = rules.ceiling;
    costNote = source.costNote || "";
    reference = Array.isArray(source.reference) ? source.reference : [];
    priorities = normalizePriorities(source.priorities || {});
    models = dedupe((source.models || []).map(hydrateModel).filter(Boolean));
    absorbListingModels();
    var front = models.filter(function (model) {
      return model.status === "front-runner";
    });
    front.sort(byRank);
    if (!state.runner || !front.some(function (model) { return model.id === state.runner; })) {
      state.runner = front.length ? front[0].id : "";
    }
    state.defaultRunner = front.length ? front[0].id : "";
  }

  function fallbackBoard() {
    return {
      criteria: { milesCeiling: 25000, hideAbove: 27000 },
      priorities: {
        asOf: "2026-10-26",
        items: [
          { id: "fun", label: "Driving fun", rank: 1, detail: "Sport-wagon feel." },
          { id: "assist", label: "Driver assist", rank: 1, detail: "Lane tracing and traffic-jam assist." },
          { id: "price", label: "Price after depreciation", rank: 2, detail: "A roughly two-year-old car." },
          { id: "awd", label: "AWD", rank: 3, detail: "Required on every car." },
          { id: "miles", label: "About 25,000 miles", rank: 3, detail: "Ceiling for every model." },
          { id: "range", label: "Road-trip range", rank: 4, detail: "800V preferred on an EV." },
        ],
        previously: [
          {
            asOf: "2026-10-23",
            note: "Opening order",
            items: [
              { id: "fun", label: "Driving fun", rank: 1 },
              { id: "assist", label: "Driver assist", rank: 1 },
              { id: "price", label: "Price after depreciation", rank: 2 },
              { id: "awd", label: "AWD", rank: 3 },
              { id: "range", label: "Road-trip range", rank: 4 },
            ],
          },
        ],
      },
      models: [
        { id: "i4", label: "BMW i4", chip: "BMW i4", status: "front-runner", rank: 1, trend: "gaining" },
        { id: "signia", label: "Crown Signia", chip: "Crown Signia", status: "front-runner", rank: 2, trend: "gaining" },
        { id: "model3", label: "Model 3", chip: "Model 3", status: "front-runner", rank: 3, trend: "steady" },
        { id: "ioniq5", label: "Ioniq 5", chip: "Ioniq 5", status: "considering", rank: 4, trend: "fading" },
        { id: "v60cc", label: "V60 Cross Country", chip: "V60 CC", status: "considering", rank: 5, trend: "steady" },
        { id: "q6", label: "Q6 e-tron", chip: "Q6 e-tron", status: "considering", rank: 6, trend: "fading" },
      ],
    };
  }

  function normalizePriorities(raw) {
    var items = Array.isArray(raw.items) ? raw.items.slice() : [];
    if (!items.some(function (item) { return item && item.id === "miles"; })) {
      items.push({ id: "miles", rank: 3, detail: "Ceiling for every model." });
    }
    var prev = raw.previously || raw.history || [];
    if (prev && !Array.isArray(prev)) prev = [prev];
    if (!Array.isArray(prev)) prev = [];
    return {
      asOf: raw.asOf || "",
      items: items.map(displayPriority).filter(Boolean),
      previously: prev,
    };
  }

  function displayPriority(item) {
    if (!item || (!item.id && !item.label)) return null;
    var next = {
      id: item.id || item.label,
      label: item.label || item.id,
      rank: item.rank == null ? 99 : Number(item.rank),
      detail: item.detail || "",
    };
    if (next.id === "miles") {
      next.label = "About " + Number(rules.ceiling).toLocaleString("en-US") + " miles";
      if (!next.detail) next.detail = "Ceiling for every model.";
    }
    return next;
  }

  function hydrateModel(raw) {
    if (!raw || !raw.id) return null;
    var status = STATUSES[raw.status] ? raw.status : "considering";
    var trend = TRENDS[raw.trend] ? raw.trend : "steady";
    return {
      id: String(raw.id),
      label: raw.label || raw.id,
      chip: raw.chip || raw.label || raw.id,
      trim: raw.trim || "",
      status: status,
      rank: raw.rank == null ? 90 : Number(raw.rank),
      trend: trend,
      fit: raw.fit || "",
      specs: Array.isArray(raw.specs) ? raw.specs : [],
      reason: raw.reason || "",
    };
  }

  function dedupe(list) {
    var seen = {};
    return list.filter(function (model) {
      if (seen[model.id]) return false;
      seen[model.id] = true;
      return true;
    });
  }

  function absorbListingModels() {
    var known = {};
    models.forEach(function (model) {
      known[model.id] = true;
    });
    cars.forEach(function (car) {
      if (!car.modelId || known[car.modelId]) return;
      known[car.modelId] = true;
      models.push(
        hydrateModel({
          id: car.modelId,
          label: [car.make, car.model].filter(Boolean).join(" ") || car.modelId,
          status: "considering",
          trend: "steady",
          rank: 80,
        })
      );
    });
  }

  function renderAll() {
    renderPriorities();
    renderRunners();
    renderContenders();
    renderGone();
    var note = document.getElementById("cost-note");
    if (note) note.textContent = costNote;
  }

  function renderPriorities() {
    var items = sortByRank(priorities.items);
    var history = historyView(items);
    var chips = items
      .map(function (item) {
        var mark = history.marks[item.id];
        var shift = mark
          ? '<span class="pshift">' + esc(mark.text) + "</span>"
          : "";
        return (
          '<li class="pchip' +
          (mark && mark.fresh ? " is-new" : "") +
          '"><span class="prank">' +
          esc(padRank(item.rank)) +
          shift +
          '</span><span class="plabel">' +
          esc(item.label) +
          "</span>" +
          (item.detail ? '<span class="pdetail">' + esc(item.detail) + "</span>" : "") +
          "</li>"
        );
      })
      .join("");
    var asOf = priorities.asOf
      ? '<p class="strip-asof">As of ' + esc(fullDate(priorities.asOf)) + "</p>"
      : "";
    priorityStrip.innerHTML =
      '<div class="strip-head"><p class="strip-k" id="priorities-label">Priorities</p>' +
      asOf +
      '</div><ol class="pchips" aria-labelledby="priorities-label">' +
      chips +
      "</ol>" +
      '<p class="rule-line">' +
      esc(ruleSentence()) +
      "</p>" +
      history.html +
      referenceHtml();
  }

  function historyView(items) {
    var snaps = (priorities.previously || []).slice().sort(function (a, b) {
      return String(b.asOf || "").localeCompare(String(a.asOf || ""));
    });
    if (!snaps.length) return { html: "", marks: {} };
    var latest = snaps[0];
    var prevItems = Array.isArray(latest.items) ? latest.items : [];
    var prevById = {};
    prevItems.forEach(function (item) {
      if (item && item.id) prevById[item.id] = item;
    });
    var curById = {};
    items.forEach(function (item) {
      curById[item.id] = item;
    });
    var marks = {};
    var deltas = [];
    items.forEach(function (item) {
      var old = prevById[item.id];
      if (!old) {
        marks[item.id] = { text: "New", fresh: true };
        deltas.push(item.label + " added");
      } else if (Number(old.rank) !== Number(item.rank)) {
        marks[item.id] = { text: "was " + old.rank, fresh: false };
        var up = Number(item.rank) < Number(old.rank);
        deltas.push(item.label + (up ? " up from " : " down from ") + old.rank);
      }
    });
    prevItems.forEach(function (old) {
      if (!old || !old.id || curById[old.id]) return;
      deltas.push((old.label || old.id) + " left the list");
    });
    var order = sortByRank(
      prevItems.map(function (item) {
        return {
          id: item.id,
          label: item.label || (curById[item.id] && curById[item.id].label) || item.id,
          rank: item.rank,
        };
      })
    )
      .map(function (item) {
        return item.label;
      })
      .join(", ");
    var when = latest.asOf ? fullDate(latest.asOf) : "";
    var lead = [when, latest.note, order].filter(Boolean).join(" · ");
    var deltaText = deltas.length ? deltas.join(" · ") : "Same order today.";
    var html =
      '<p class="phistory"><span class="strip-k">Previously</span> ' +
      esc(lead) +
      ' <span class="hdelta">' +
      esc(deltaText) +
      "</span></p>";
    if (snaps.length > 1) {
      html +=
        '<details class="earlier"><summary>Earlier priority orders</summary><ul>' +
        snaps
          .slice(1)
          .map(function (snap) {
            var labels = sortByRank(snap.items || [])
              .map(function (item) {
                return item.label || item.id;
              })
              .join(", ");
            return (
              "<li>" +
              esc([snap.asOf ? fullDate(snap.asOf) : "", snap.note, labels].filter(Boolean).join(" · ")) +
              "</li>"
            );
          })
          .join("") +
        "</ul></details>";
    }
    return { html: html, marks: marks };
  }

  function referenceHtml() {
    if (!reference.length) return "";
    return (
      '<p class="reference-line"><span class="strip-k">Reference</span> ' +
      esc(reference.join(" · ")) +
      "</p>"
    );
  }

  function ruleSentence() {
    var ceiling = Number(rules.ceiling).toLocaleString("en-US");
    var hide = Number(rules.hideAbove).toLocaleString("en-US");
    return (
      "Ceiling is about " +
      ceiling +
      " miles. A listing over " +
      hide +
      " miles stays off the front-runners and the other contenders unless it is flagged as a value exception."
    );
  }

  function renderRunners() {
    var front = models
      .filter(function (model) {
        return model.status === "front-runner";
      })
      .sort(byRank);
    runnerGrid.style.setProperty("--cols", String(Math.max(front.length, 1)));
    runnerTabs.innerHTML = front
      .map(function (model) {
        var visible = listed(model.id);
        var low = lowestPrice(visible);
        var price = visible.length && low != null ? money(low) : "No listing";
        var on = model.id === state.runner;
        return (
          '<button type="button" class="runner-tab" role="tab" data-id="' +
          esc(model.id) +
          '" id="tab-' +
          esc(model.id) +
          '" aria-controls="panel-' +
          esc(model.id) +
          '" aria-selected="' +
          (on ? "true" : "false") +
          '" tabindex="' +
          (on ? "0" : "-1") +
          '"><span class="tab-name">' +
          esc(model.chip) +
          '</span><span class="tab-price">' +
          esc(price) +
          "</span></button>"
        );
      })
      .join("");
    runnerGrid.innerHTML = front.length
      ? front.map(runnerArticle).join("")
      : '<p class="callout">No model is marked as a front-runner. Set status to “front-runner” in data/models.json.</p>';
    syncRunnerTabs(false);
  }

  function runnerArticle(model) {
    var groups = splitCars(model.id);
    var low = lowestPrice(groups.visible);
    return (
      '<article class="runner" role="tabpanel" id="panel-' +
      esc(model.id) +
      '" data-id="' +
      esc(model.id) +
      '" aria-labelledby="runner-title-' +
      esc(model.id) +
      '"><header class="runner-head"><p class="runner-rank">' +
      esc(padRank(model.rank)) +
      '</p><div class="runner-id"><h2 id="runner-title-' +
      esc(model.id) +
      '">' +
      esc(model.label) +
      "</h2>" +
      (model.trim ? '<p class="trim">' + esc(model.trim) + "</p>" : "") +
      '</div><p class="trend trend-' +
      esc(model.trend) +
      '">' +
      esc(trendText(model.trend)) +
      "</p></header>" +
      fitHtml(model.fit) +
      specsHtml(model.specs) +
      fromLine(groups.visible, low) +
      (groups.visible.length
        ? '<ul class="runner-listings">' + groups.visible.map(listingHtml).join("") + "</ul>"
        : "") +
      emptyNote(groups) +
      "</article>"
    );
  }

  function renderContenders() {
    var list = models
      .filter(function (model) {
        return model.status === "considering";
      })
      .sort(byRank);
    contenderList.innerHTML = list.length
      ? list.map(contenderHtml).join("")
      : '<p class="callout">No other contenders on the board.</p>';
    var dropped = models
      .filter(function (model) {
        return model.status === "dropped";
      })
      .sort(byRank);
    droppedEl.innerHTML = dropped.length
      ? '<p class="strip-k">Ruled out</p><ul>' +
        dropped
          .map(function (model) {
            return (
              "<li><strong>" +
              esc(model.label) +
              "</strong>" +
              (model.reason ? "<span>" + esc(model.reason) + "</span>" : "") +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
      : "";
  }

  function contenderHtml(model) {
    var groups = splitCars(model.id);
    var count = countLabel(groups.visible);
    return (
      '<details class="contender" id="model-' +
      esc(model.id) +
      '"><summary><span class="contender-rank">' +
      esc(padRank(model.rank)) +
      '</span><h3 class="contender-name">' +
      esc(model.label) +
      '</h3><span class="trend trend-' +
      esc(model.trend) +
      '">' +
      esc(trendText(model.trend)) +
      '</span><span class="contender-count">' +
      esc(count) +
      "</span></summary><div class=\"contender-body\">" +
      fitHtml(model.fit) +
      specsHtml(model.specs) +
      (groups.visible.length
        ? '<ul class="runner-listings">' + groups.visible.map(listingHtml).join("") + "</ul>"
        : "") +
      emptyNote(groups) +
      "</div></details>"
    );
  }

  function countLabel(visible) {
    if (!visible.length) return "0 live";
    var low = lowestPrice(visible);
    return visible.length + " live" + (low == null ? "" : " · " + money(low));
  }

  function fromLine(visible, low) {
    if (!visible.length) return "";
    var noun = visible.length === 1 ? " listing" : " listings";
    return (
      '<p class="from-line"><span class="from-k">From</span><span class="from-price">' +
      esc(low == null ? "Price not listed" : money(low)) +
      '</span><span class="from-meta">' +
      esc(visible.length + noun) +
      "</span></p>"
    );
  }

  function emptyNote(groups) {
    if (!groups.visible.length && !groups.hidden.length) {
      return '<p class="fine">No live listing in this tracker yet.</p>';
    }
    return hiddenNote(groups.hidden);
  }

  function hiddenNote(hidden) {
    if (!hidden.length) return "";
    var n = hidden.length;
    var noun = n === 1 ? "listing" : "listings";
    var be = n === 1 ? "is" : "are";
    var sit = n === 1 ? "It sits" : "They sit";
    return (
      '<p class="fine aside-note">' +
      n +
      " " +
      noun +
      " " +
      be +
      " over " +
      Number(rules.hideAbove).toLocaleString("en-US") +
      " miles with no value exception. " +
      sit +
      ' under <a href="#gone">Off the market</a>.</p>'
    );
  }

  function renderGone() {
    var hidden = cars.filter(overHideLine).sort(byPrice);
    var hideLabel = Number(rules.hideAbove).toLocaleString("en-US");
    goneMeta.textContent =
      goneEntries.length +
      " logged" +
      (hidden.length ? " · " + hidden.length + " over " + hideLabel + " miles" : "");
    milesAside.innerHTML = hidden.length
      ? '<div class="miles-block"><h3>Over ' +
        esc(hideLabel) +
        " miles</h3><p>No value exception on these. They stay out of the front-runners and the other contenders.</p><ul class=\"aside-list\">" +
        hidden.map(asideItem).join("") +
        "</ul></div>"
      : "";
    if (goneIntro) {
      goneIntro.textContent =
        "A car lands in the log when it is missing for two checks in a row, or the page says sold, removed, or not found. Days listed are only the days this tracker saw it. Comparable means the right model year, AWD, a clean title, and about " +
        Number(rules.ceiling).toLocaleString("en-US") +
        " miles or fewer.";
    }

    var pool = goneEntries.filter(function (entry) {
      if (state.gone !== "all" && entry.modelId !== state.gone) return false;
      if (state.comparable && !entry.comparable) return false;
      return true;
    });
    pool.sort(function (a, b) {
      return String(b.lastSeen).localeCompare(String(a.lastSeen));
    });

    var ids = uniqueIds(goneEntries);
    var chips = [{ id: "all", label: "All · " + goneEntries.length, pressed: state.gone === "all" }].concat(
      ids.map(function (id) {
        var count = goneEntries.filter(function (entry) {
          return entry.modelId === id;
        }).length;
        return {
          id: id,
          label: labelFor(id) + " · " + count,
          pressed: state.gone === id,
        };
      })
    );
    renderChips(goneFilters, chips);
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

  function asideItem(car) {
    var href = safeUrl(car.url);
    var name = [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ");
    var title = href
      ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + "</a>"
      : esc(name);
    var meta = [car.miles == null ? "" : miles(car.miles), car.price == null ? "" : money(car.price), car.dealer, car.city]
      .filter(Boolean)
      .join(" · ");
    return "<li>" + title + '<span class="aside-meta">' + esc(meta) + "</span></li>";
  }

  function listingHtml(car) {
    var href = safeUrl(car.url);
    var price = car.price == null ? "Price not listed" : money(car.price);
    var priceHtml = href
      ? '<a class="listing-price" href="' +
        esc(href) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(price) +
        "</a>"
      : '<span class="listing-price">' + esc(price) + "</span>";
    var go = href
      ? '<a class="listing-link listing-go" href="' +
        esc(href) +
        '" target="_blank" rel="noopener noreferrer">Listing</a>'
      : "";
    var meta = [car.year, car.trim || car.drivetrain, car.miles == null ? "" : miles(car.miles)]
      .filter(Boolean)
      .join(" · ");
    var where = [car.dealer, car.city].filter(Boolean).join(" · ");
    var ex = exceptionInfo(car);
    var badges = badgesHtml(car);
    var over = showOverLine(car) ? '<p class="over-miles">' + esc(overLineText()) + "</p>" : "";
    var exception = "";
    if (showException(car, ex)) {
      exception =
        '<p class="exception"><span class="badge badge-exception">Mileage exception</span>' +
        (ex.reason ? '<span class="exception-reason">' + esc(ex.reason) + "</span>" : "") +
        "</p>";
    }
    var fee = feeLine(car);
    var change = deltaLine(historyFor(car));
    var delta =
      change.tone === "drop" || change.tone === "rise"
        ? '<p class="delta ' + change.tone + '">' + esc(change.text) + "</p>"
        : "";
    var seen = staleSeen(car);
    return (
      '<li class="listing" id="listing-' +
      esc(domId(car.id)) +
      '"><div class="listing-top">' +
      priceHtml +
      delta +
      go +
      "</div>" +
      (meta ? '<p class="listing-meta">' + esc(meta) + "</p>" : "") +
      (where ? '<p class="listing-where">' + esc(where) + "</p>" : "") +
      over +
      exception +
      (fee ? '<p class="fee">' + esc(fee) + "</p>" : "") +
      (seen ? '<p class="seen">' + esc(seen) + "</p>" : "") +
      (badges ? '<div class="kicker">' + badges + "</div>" : "") +
      whyHtml(car) +
      "</li>"
    );
  }

  function badgesHtml(car) {
    var badges = [];
    if (car.fit && car.fit !== "match") {
      badges.push(
        '<span class="badge ' +
          (FIT_CLASS[car.fit] || "badge-aside") +
          '">' +
          esc(FIT_LABEL[car.fit] || car.fit) +
          "</span>"
      );
    }
    if (car.cpo) badges.push('<span class="badge badge-title">CPO</span>');
    if (car.title === "branded") badges.push('<span class="badge badge-aside">Branded title</span>');
    if (car.title === "buyback") badges.push('<span class="badge badge-aside">Buyback title</span>');
    if (car.timing && car.timing.call) {
      badges.push(
        '<span class="badge ' + timingClass(car.timing.call) + '">' + esc(car.timing.call) + "</span>"
      );
    }
    if (car.motivation && car.motivation.score) {
      badges.push(
        '<span class="badge ' +
          motivationClass(car.motivation.score) +
          '">' +
          esc(car.motivation.score) +
          " motivation</span>"
      );
    }
    return badges.join("");
  }

  function whyHtml(car) {
    var bits = [];
    if (car.motivation && car.motivation.reason) {
      bits.push("<p><strong>Motivation.</strong> " + esc(car.motivation.reason) + "</p>");
    }
    if (car.timing && car.timing.reason) {
      bits.push("<p><strong>Timing.</strong> " + esc(car.timing.reason) + "</p>");
    }
    if (!bits.length) return "";
    return '<details class="details"><summary>Why</summary>' + bits.join("") + "</details>";
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
      esc(domId(entry.id)) +
      '"><div class="gone-top"><div><div class="kicker">' +
      badge +
      "</div><h3>" +
      titleHtml +
      '</h3><p class="where">' +
      esc(where) +
      '</p></div><div class="price-stack"><p class="gone-price">' +
      esc([prices, cuts, days].filter(Boolean).join(" · ")) +
      '</p><p class="seen">' +
      esc(shortDate(entry.firstSeen) + " – " + shortDate(entry.lastSeen)) +
      "</p></div></div>" +
      (entry.outcome ? '<p class="outcome">' + esc(sentence(entry.outcome)) + "</p>" : "") +
      (href
        ? '<a class="listing-link" href="' +
          esc(href) +
          '" target="_blank" rel="noopener noreferrer">View listing</a>'
        : "") +
      "</article>"
    );
  }

  function splitCars(modelId) {
    var all = cars.filter(function (car) {
      return car.modelId === modelId;
    });
    return {
      visible: all.filter(isListed).sort(byPrice),
      hidden: all.filter(overHideLine).sort(byPrice),
    };
  }

  function listed(modelId) {
    return splitCars(modelId).visible;
  }

  function isListed(car) {
    return !overHideLine(car);
  }

  function overHideLine(car) {
    var miles = milesNumber(car);
    if (miles == null) return false;
    if (miles <= rules.hideAbove) return false;
    return !exceptionInfo(car).on;
  }

  function showOverLine(car) {
    var miles = milesNumber(car);
    if (miles == null || exceptionInfo(car).on) return false;
    return miles > rules.ceiling && miles <= rules.hideAbove;
  }

  function showException(car, ex) {
    var info = ex || exceptionInfo(car);
    if (!info.on) return false;
    var miles = milesNumber(car);
    if (miles == null) return true;
    return miles > rules.ceiling;
  }

  function exceptionInfo(car) {
    if (car.mileageException === true) {
      return { on: true, reason: car.mileageExceptionReason || "" };
    }
    return { on: false, reason: "" };
  }

  function milesNumber(car) {
    if (car.miles == null || car.miles === "") return null;
    var n = Number(car.miles);
    return isFinite(n) ? n : null;
  }

  function overLineText() {
    return "Over the " + Math.round(rules.ceiling / 1000) + "k line";
  }

  function lowestPrice(list) {
    var prices = list
      .map(function (car) {
        return car.price;
      })
      .filter(function (price) {
        return price != null;
      });
    if (!prices.length) return null;
    return Math.min.apply(null, prices);
  }

  function byPrice(a, b) {
    var ap = a.price == null ? Infinity : a.price;
    var bp = b.price == null ? Infinity : b.price;
    if (ap !== bp) return ap - bp;
    var am = a.miles == null ? Infinity : a.miles;
    var bm = b.miles == null ? Infinity : b.miles;
    return am - bm;
  }

  function byRank(a, b) {
    var ar = a.rank == null ? 99 : Number(a.rank);
    var br = b.rank == null ? 99 : Number(b.rank);
    if (ar !== br) return ar - br;
    return String(a.label || "").localeCompare(String(b.label || ""));
  }

  function sortByRank(items) {
    return items
      .map(function (item, index) {
        return { item: item, index: index };
      })
      .sort(function (a, b) {
        var ar = a.item.rank == null ? 99 : Number(a.item.rank);
        var br = b.item.rank == null ? 99 : Number(b.item.rank);
        if (ar !== br) return ar - br;
        return a.index - b.index;
      })
      .map(function (wrap) {
        return wrap.item;
      });
  }

  function fitHtml(text) {
    if (!text) return "";
    return '<p class="fit-line">' + esc(text) + "</p>";
  }

  function specsHtml(specs) {
    if (!specs || !specs.length) return "";
    return (
      '<ul class="specs">' +
      specs
        .map(function (spec) {
          return (
            '<li><span class="spec-k">' +
            esc(spec.k || "") +
            '</span><span class="spec-v">' +
            esc(spec.v || "") +
            (spec.u ? "<small>" + esc(spec.u) + "</small>" : "") +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function labelFor(id) {
    var model = models.filter(function (item) {
      return item.id === id;
    })[0];
    if (model) return model.chip || model.label;
    var car = cars.filter(function (item) {
      return item.modelId === id;
    })[0];
    var gone = goneEntries.filter(function (item) {
      return item.modelId === id;
    })[0];
    var sample = car || gone;
    if (sample) return [sample.make, sample.model].filter(Boolean).join(" ") || id;
    return id;
  }

  function uniqueIds(list) {
    var seen = {};
    list.forEach(function (item) {
      if (item.modelId) seen[item.modelId] = true;
    });
    return Object.keys(seen).sort(function (a, b) {
      var am = models.filter(function (model) { return model.id === a; })[0];
      var bm = models.filter(function (model) { return model.id === b; })[0];
      return ((am && am.rank) || 99) - ((bm && bm.rank) || 99);
    });
  }

  function renderChips(container, defs) {
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
    if (focusedId && window.CSS && CSS.escape) {
      var again = container.querySelector('[data-id="' + CSS.escape(focusedId) + '"]');
      if (again) again.focus();
    }
  }

  function feeLine(car) {
    if (car.priceBasis === "with-fees") return "Includes listed fees";
    if (car.priceBasis === "with-shipping") return "Includes shipping";
    if (car.docFee) return "Doc fee " + money(car.docFee);
    return "";
  }

  function staleSeen(car) {
    if (!car.lastSeen || !car.checked || car.lastSeen === car.checked) return "";
    return "Last seen " + shortDate(car.lastSeen);
  }

  function pricePath(entry) {
    if (entry.firstPrice == null && entry.lastPrice == null) return "Price not listed";
    if (entry.firstPrice == null) return money(entry.lastPrice);
    if (entry.lastPrice == null || entry.firstPrice === entry.lastPrice) return money(entry.firstPrice);
    return money(entry.firstPrice) + " → " + money(entry.lastPrice);
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
    if (points.length < 2) return { text: "", tone: "flat" };
    var delta = points[points.length - 1].price - points[0].price;
    if (delta === 0) return { text: "", tone: "flat" };
    var tone = delta < 0 ? "drop" : "rise";
    var sign = delta < 0 ? "−" : "+";
    return { text: sign + money(Math.abs(delta)) + " from " + shortDate(points[0].date), tone: tone };
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

  function trendText(trend) {
    if (trend === "gaining") return "Gaining";
    if (trend === "fading") return "Fading";
    return "Steady";
  }

  function syncRunnerTabs(focusTab) {
    var mobile = window.matchMedia("(max-width: 899px)").matches;
    Array.prototype.forEach.call(document.querySelectorAll(".runner"), function (panel) {
      var on = !mobile || panel.getAttribute("data-id") === state.runner;
      panel.hidden = !on;
    });
    Array.prototype.forEach.call(document.querySelectorAll(".runner-tab"), function (tab) {
      var on = tab.getAttribute("data-id") === state.runner;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      if (on && focusTab) tab.focus();
    });
  }

  function selectRunner(id, focusTab) {
    var front = models.filter(function (model) {
      return model.status === "front-runner";
    });
    if (!front.some(function (model) { return model.id === id; })) return;
    state.runner = id;
    syncRunnerTabs(focusTab);
    writeUrl();
  }

  function bind() {
    runnerTabs.addEventListener("click", function (event) {
      var tab = event.target.closest(".runner-tab");
      if (!tab) return;
      selectRunner(tab.getAttribute("data-id"), false);
    });
    runnerTabs.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
        return;
      }
      var tabs = Array.prototype.slice.call(document.querySelectorAll(".runner-tab"));
      if (!tabs.length) return;
      var current = 0;
      tabs.forEach(function (tab, index) {
        if (tab.getAttribute("data-id") === state.runner) current = index;
      });
      var next = current;
      if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      event.preventDefault();
      selectRunner(tabs[next].getAttribute("data-id"), true);
    });
    var mobileQuery = window.matchMedia("(max-width: 899px)");
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener("change", function () {
        syncRunnerTabs(false);
      });
    }
    goneFilters.addEventListener("click", function (event) {
      var button = event.target.closest("button.chip");
      if (!button) return;
      state.gone = button.getAttribute("data-id") || "all";
      renderGone();
      writeUrl();
    });
    comparableToggle.addEventListener("click", function () {
      state.comparable = comparableToggle.getAttribute("aria-pressed") !== "true";
      renderGone();
      writeUrl();
    });
    document.addEventListener("click", function (event) {
      var link = event.target.closest('a[href="#gone"]');
      if (!link) return;
      var fold = document.getElementById("gone");
      if (fold) fold.open = true;
    });
    window.addEventListener("popstate", function () {
      var next = readState();
      state.runner = next.runner;
      state.focusModel = next.focusModel;
      state.gone = next.gone;
      state.comparable = next.comparable;
      if (models.length) {
        var front = models.filter(function (model) {
          return model.status === "front-runner";
        });
        if (!front.some(function (model) { return model.id === state.runner; })) {
          state.runner = front.length ? front[0].id : "";
        }
        syncRunnerTabs(false);
        renderGone();
        openDeepLink();
      }
    });
  }

  function openDeepLink() {
    if (location.hash === "#gone") {
      var fold = document.getElementById("gone");
      if (fold) fold.open = true;
    }
    var id = state.focusModel;
    if (!id) return;
    var panel = document.getElementById("panel-" + id);
    if (panel) {
      state.runner = id;
      syncRunnerTabs(false);
      return;
    }
    var details = document.getElementById("model-" + id);
    if (details) {
      details.open = true;
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      details.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  function readState() {
    var params = new URLSearchParams(window.location.search);
    var runner = params.get("runner") || "";
    var focusModel = params.get("model") || "";
    return {
      runner: runner || focusModel,
      focusModel: focusModel,
      gone: params.get("gone") || "all",
      comparable: params.get("comparable") === "1",
      defaultRunner: "",
    };
  }

  function writeUrl() {
    if (!urlReady) return;
    var url = new URL(window.location.href);
    var hash = url.hash;
    url.search = "";
    if (state.runner && state.runner !== state.defaultRunner) url.searchParams.set("runner", state.runner);
    if (state.gone && state.gone !== "all") url.searchParams.set("gone", state.gone);
    if (state.comparable) url.searchParams.set("comparable", "1");
    url.hash = hash;
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
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
    if (media.addEventListener) {
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
    }
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

  function padRank(rank) {
    if (rank == null || rank === "") return "";
    var n = String(rank);
    return n.length < 2 ? "0" + n : n;
  }

  function positive(value, fallback) {
    var n = Number(value);
    return isFinite(n) && n > 0 ? n : fallback;
  }

  function domId(id) {
    return String(id == null ? "" : id).replace(/[^A-Za-z0-9_-]/g, "");
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
