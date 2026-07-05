(function () {
  "use strict";

  var REFRESH_MS = 15 * 60 * 1000;
  var GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

  var DEFAULT_LOCATION = {
    name: "Norwich",
    admin1: "England",
    country: "United Kingdom",
    latitude: 52.6286,
    longitude: 1.2926
  };

  function loadStoredLocation() {
    try {
      var raw = localStorage.getItem("location");
      if (!raw) return DEFAULT_LOCATION;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
        return parsed;
      }
    } catch (e) {}
    return DEFAULT_LOCATION;
  }

  function buildApiUrl(location) {
    return "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + location.latitude + "&longitude=" + location.longitude +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,is_day" +
      "&hourly=temperature_2m,precipitation_probability,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=auto" +
      "&forecast_days=7";
  }

  // WMO weather interpretation codes -> [emoji, label]
  var WEATHER_CODES = {
    0: ["☀️", "Clear sky"],
    1: ["🌤️", "Mainly clear"],
    2: ["⛅", "Partly cloudy"],
    3: ["☁️", "Overcast"],
    45: ["🌫️", "Fog"],
    48: ["🌫️", "Freezing fog"],
    51: ["🌦️", "Light drizzle"],
    53: ["🌦️", "Drizzle"],
    55: ["🌧️", "Dense drizzle"],
    56: ["🌨️", "Freezing drizzle"],
    57: ["🌨️", "Freezing drizzle"],
    61: ["🌦️", "Light rain"],
    63: ["🌧️", "Rain"],
    65: ["🌧️", "Heavy rain"],
    66: ["🌨️", "Freezing rain"],
    67: ["🌨️", "Freezing rain"],
    71: ["🌨️", "Light snow"],
    73: ["❄️", "Snow"],
    75: ["❄️", "Heavy snow"],
    77: ["❄️", "Snow grains"],
    80: ["🌦️", "Light showers"],
    81: ["🌧️", "Showers"],
    82: ["⛈️", "Violent showers"],
    85: ["🌨️", "Snow showers"],
    86: ["🌨️", "Snow showers"],
    95: ["⛈️", "Thunderstorm"],
    96: ["⛈️", "Thunderstorm, hail"],
    99: ["⛈️", "Thunderstorm, hail"]
  };

  function weatherInfo(code, isDay) {
    var entry = WEATHER_CODES[code] || ["🌤️", "Unknown"];
    if (code === 0 && isDay === 0) return ["🌙", "Clear night"];
    if ((code === 1 || code === 2) && isDay === 0) return ["🌙", entry[1]];
    return entry;
  }

  function loadStoredUnit() {
    try {
      var stored = localStorage.getItem("unit");
      if (stored === "C" || stored === "F") return stored;
    } catch (e) {}
    return "C";
  }

  var state = { unit: loadStoredUnit(), data: null, location: loadStoredLocation() };

  var els = {
    status: document.getElementById("status"),
    current: document.getElementById("current"),
    currentIcon: document.getElementById("current-icon"),
    currentTemp: document.getElementById("current-temp"),
    currentDesc: document.getElementById("current-desc"),
    currentFeels: document.getElementById("current-feels"),
    currentWind: document.getElementById("current-wind"),
    windUnit: document.getElementById("wind-unit"),
    currentHumidity: document.getElementById("current-humidity"),
    currentRain: document.getElementById("current-rain"),
    hourlySection: document.getElementById("hourly-section"),
    hourlyScroll: document.getElementById("hourly-scroll"),
    dailySection: document.getElementById("daily-section"),
    dailyGrid: document.getElementById("daily-grid"),
    updatedAt: document.getElementById("updated-at"),
    unitToggle: document.getElementById("unit-toggle"),
    themeToggle: document.getElementById("theme-toggle"),
    locationName: document.getElementById("location-name"),
    locationSubtitle: document.getElementById("location-subtitle"),
    locationInput: document.getElementById("location-input"),
    locationResults: document.getElementById("location-results"),
    mapToggle: document.getElementById("map-toggle"),
    locationMap: document.getElementById("location-map"),
    geolocateBtn: document.getElementById("geolocate-btn")
  };

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    els.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  applyTheme(currentTheme());

  els.themeToggle.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  });

  var lastResults = [];
  var activeIndex = -1;
  var searchDebounceId = null;
  var searchAbortController = null;

  function updateLocationHeader(location) {
    els.locationName.textContent = location.name;
    var parts = [];
    if (location.admin1 && location.admin1 !== location.name) parts.push(location.admin1);
    if (location.country) parts.push(location.country);
    els.locationSubtitle.textContent = parts.join(", ");
  }

  function resetToLoading() {
    els.status.hidden = false;
    els.status.classList.remove("error");
    els.status.textContent = "Loading forecast…";
    els.current.hidden = true;
    els.hourlySection.hidden = true;
    els.dailySection.hidden = true;
  }

  function hideResults() {
    els.locationResults.hidden = true;
    els.locationResults.innerHTML = "";
    els.locationInput.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function highlightActive(items) {
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("is-active", i === activeIndex);
    }
    if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function renderResults(results) {
    lastResults = results;
    activeIndex = -1;
    els.locationResults.innerHTML = "";

    if (!results.length) {
      showLocationMessage("No matches found");
      return;
    }

    results.forEach(function (r, i) {
      var li = document.createElement("li");
      li.className = "location-result";
      li.setAttribute("role", "option");
      li.setAttribute("data-index", String(i));

      var nameEl = document.createElement("div");
      nameEl.className = "lr-name";
      nameEl.textContent = r.name;

      var detailParts = [];
      if (r.admin2 && r.admin2 !== r.name) detailParts.push(r.admin2);
      if (r.admin1 && r.admin1 !== r.name) detailParts.push(r.admin1);
      if (r.country) detailParts.push(r.country);
      var detailEl = document.createElement("div");
      detailEl.className = "lr-detail";
      detailEl.textContent = detailParts.join(", ");

      li.appendChild(nameEl);
      li.appendChild(detailEl);
      els.locationResults.appendChild(li);
    });

    els.locationResults.hidden = false;
    els.locationInput.setAttribute("aria-expanded", "true");
  }

  function runSearch(query) {
    if (searchAbortController) searchAbortController.abort();
    searchAbortController = new AbortController();

    var url = GEOCODE_URL +
      "?name=" + encodeURIComponent(query) +
      "&count=8&language=en&format=json";

    fetch(url, { signal: searchAbortController.signal })
      .then(function (res) { return res.json(); })
      .then(function (data) { renderResults(data.results || []); })
      .catch(function (err) {
        if (err.name === "AbortError") return;
        renderResults([]);
      });
  }

  function scheduleSearch(query) {
    if (searchDebounceId) clearTimeout(searchDebounceId);
    searchDebounceId = setTimeout(function () { runSearch(query); }, 300);
  }

  function selectLocation(location) {
    state.location = location;
    try { localStorage.setItem("location", JSON.stringify(location)); } catch (e) {}
    updateLocationHeader(location);
    hideResults();
    els.locationInput.value = "";
    resetToLoading();
    load();
    if (map && mapMarker) {
      mapMarker.setLatLng([location.latitude, location.longitude]);
      map.panTo([location.latitude, location.longitude]);
    }
  }

  els.locationInput.addEventListener("input", function () {
    var query = els.locationInput.value.trim();
    if (query.length < 2) {
      if (searchDebounceId) clearTimeout(searchDebounceId);
      hideResults();
      return;
    }
    showLocationMessage("Searching…");
    scheduleSearch(query);
  });

  els.locationInput.addEventListener("keydown", function (e) {
    var items = els.locationResults.querySelectorAll(".location-result");
    if (e.key === "ArrowDown") {
      if (!items.length) return;
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      highlightActive(items);
    } else if (e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      highlightActive(items);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].click();
      } else if (items.length === 1) {
        e.preventDefault();
        items[0].click();
      }
    } else if (e.key === "Escape") {
      hideResults();
    }
  });

  els.locationResults.addEventListener("click", function (e) {
    var item = e.target.closest(".location-result");
    if (!item) return;
    var idx = Number(item.getAttribute("data-index"));
    var location = lastResults[idx];
    if (location) selectLocation(location);
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".location-search")) hideResults();
  });

  var map = null;
  var mapMarker = null;

  function ensureMap() {
    if (map) return;
    map = L.map(els.locationMap, {
      minZoom: 2,
      worldCopyJump: true
    }).setView([state.location.latitude, state.location.longitude], 8);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapMarker = L.marker([state.location.latitude, state.location.longitude]).addTo(map);

    map.on("click", function (e) {
      handleMapClick(e.latlng.lat, e.latlng.lng);
    });
  }

  function handleMapClick(lat, lon) {
    mapMarker.setLatLng([lat, lon]);
    reverseGeocode(lat, lon).then(selectLocation);
  }

  function reverseGeocode(lat, lon) {
    var url = "https://nominatim.openstreetmap.org/reverse" +
      "?format=jsonv2&lat=" + lat + "&lon=" + lon + "&zoom=16&addressdetails=1&accept-language=en";

    return fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var addr = data.address || {};
        // Prefer town/village over city: at low zoom Nominatim's "city" field can
        // resolve to an administrative district (e.g. "South Norfolk") rather than
        // an actual settlement, while the real place name only shows up here.
        var name = addr.town || addr.village || addr.city || addr.hamlet || addr.suburb || addr.county || "Pinned location";
        return {
          name: name,
          admin1: addr.state || addr.county || "",
          country: addr.country || "",
          latitude: lat,
          longitude: lon
        };
      })
      .catch(function () {
        return {
          name: lat.toFixed(2) + ", " + lon.toFixed(2),
          admin1: "",
          country: "",
          latitude: lat,
          longitude: lon
        };
      });
  }

  els.mapToggle.addEventListener("click", function () {
    var willShow = els.locationMap.hidden;
    els.locationMap.hidden = !willShow;
    els.mapToggle.setAttribute("aria-pressed", String(willShow));
    if (willShow) {
      ensureMap();
      setTimeout(function () { map.invalidateSize(); }, 0);
    }
  });

  if (!navigator.geolocation) {
    els.geolocateBtn.hidden = true;
  } else {
    els.geolocateBtn.addEventListener("click", function () {
      els.geolocateBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(function (location) {
            selectLocation(location);
            els.geolocateBtn.disabled = false;
          });
        },
        function (err) {
          var message = "Couldn't get your location.";
          if (err.code === err.PERMISSION_DENIED) message = "Location access denied.";
          else if (err.code === err.TIMEOUT) message = "Location request timed out.";
          showLocationMessage(message);
          els.geolocateBtn.disabled = false;
        },
        { timeout: 10000 }
      );
    });
  }

  function showLocationMessage(message) {
    els.locationResults.innerHTML = "";
    var li = document.createElement("li");
    li.className = "location-empty";
    li.textContent = message;
    els.locationResults.appendChild(li);
    els.locationResults.hidden = false;
    els.locationInput.setAttribute("aria-expanded", "true");
  }

  function cToF(c) { return c * 9 / 5 + 32; }
  function kmhToMph(kmh) { return kmh * 0.621371; }

  function fmtTemp(celsius) {
    var v = state.unit === "C" ? celsius : cToF(celsius);
    return Math.round(v);
  }

  function fmtWind(kmh) {
    var v = state.unit === "C" ? kmh : kmhToMph(kmh);
    return Math.round(v);
  }

  function fmtHour(isoString) {
    var d = new Date(isoString);
    var h = d.getHours();
    var suffix = h >= 12 ? "pm" : "am";
    var display = h % 12 === 0 ? 12 : h % 12;
    return display + suffix;
  }

  function fmtDayName(isoDate, index) {
    if (index === 0) return "Today";
    if (index === 1) return "Tomorrow";
    var d = new Date(isoDate + "T00:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short" });
  }

  function render(data) {
    var current = data.current;
    var wi = weatherInfo(current.weather_code, current.is_day);

    els.currentIcon.textContent = wi[0];
    els.currentTemp.textContent = fmtTemp(current.temperature_2m);
    els.currentDesc.textContent = wi[1];
    els.currentFeels.textContent = fmtTemp(current.apparent_temperature);
    els.currentWind.textContent = fmtWind(current.wind_speed_10m);
    els.windUnit.textContent = state.unit === "C" ? "km/h" : "mph";
    els.currentHumidity.textContent = Math.round(current.relative_humidity_2m);
    els.currentRain.textContent = Math.round(current.precipitation_probability != null ? current.precipitation_probability : 0);

    // Hourly: next 24 entries from now
    var hourly = data.hourly;
    var nowIso = current.time;
    var startIdx = hourly.time.indexOf(nowIso);
    if (startIdx === -1) startIdx = 0;

    els.hourlyScroll.innerHTML = "";
    for (var i = startIdx; i < Math.min(startIdx + 24, hourly.time.length); i++) {
      var hwi = weatherInfo(hourly.weather_code[i], null);
      var card = document.createElement("div");
      card.className = "hour-card";
      card.innerHTML =
        '<div class="h-time">' + (i === startIdx ? "Now" : fmtHour(hourly.time[i])) + '</div>' +
        '<div class="h-icon">' + hwi[0] + '</div>' +
        '<div class="h-temp">' + fmtTemp(hourly.temperature_2m[i]) + '°</div>' +
        '<div class="h-rain">' + Math.round(hourly.precipitation_probability[i]) + '%</div>';
      els.hourlyScroll.appendChild(card);
    }

    // Daily
    var daily = data.daily;
    els.dailyGrid.innerHTML = "";
    for (var d = 0; d < daily.time.length; d++) {
      var dwi = weatherInfo(daily.weather_code[d], 1);
      var row = document.createElement("div");
      row.className = "day-row";
      row.innerHTML =
        '<div class="d-name">' + fmtDayName(daily.time[d], d) + '</div>' +
        '<div class="d-icon">' + dwi[0] + '</div>' +
        '<div class="d-rain">💧 ' + Math.round(daily.precipitation_probability_max[d]) + '%</div>' +
        '<div class="d-temps"><span class="hi">' + fmtTemp(daily.temperature_2m_max[d]) + '°</span>' +
        '<span class="lo">' + fmtTemp(daily.temperature_2m_min[d]) + '°</span></div>';
      els.dailyGrid.appendChild(row);
    }

    els.status.hidden = true;
    els.current.hidden = false;
    els.hourlySection.hidden = false;
    els.dailySection.hidden = false;
    els.updatedAt.textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function showError(message) {
    els.status.hidden = false;
    els.status.classList.add("error");
    els.status.textContent = message;
  }

  function load() {
    fetch(buildApiUrl(state.location))
      .then(function (res) {
        if (!res.ok) throw new Error("Weather service returned " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.data = data;
        render(data);
      })
      .catch(function (err) {
        showError("Couldn't load the forecast right now (" + err.message + "). Retrying shortly…");
        setTimeout(load, 30000);
      });
  }

  els.unitToggle.addEventListener("click", function () {
    state.unit = state.unit === "C" ? "F" : "C";
    els.unitToggle.textContent = "°" + state.unit;
    try { localStorage.setItem("unit", state.unit); } catch (e) {}
    if (state.data) render(state.data);
  });

  els.unitToggle.textContent = "°" + state.unit;
  updateLocationHeader(state.location);
  load();
  setInterval(load, REFRESH_MS);
})();
