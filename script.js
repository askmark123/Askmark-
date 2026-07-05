(function () {
  "use strict";

  var LAT = 52.6286;
  var LON = 1.2926;
  var TIMEZONE = "Europe/London";
  var REFRESH_MS = 15 * 60 * 1000;

  var API_URL =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + LAT + "&longitude=" + LON +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,is_day" +
    "&hourly=temperature_2m,precipitation_probability,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=" + encodeURIComponent(TIMEZONE) +
    "&forecast_days=7";

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

  var state = { unit: "C", data: null };

  var els = {
    status: document.getElementById("status"),
    current: document.getElementById("current"),
    currentIcon: document.getElementById("current-icon"),
    currentTemp: document.getElementById("current-temp"),
    currentDesc: document.getElementById("current-desc"),
    currentFeels: document.getElementById("current-feels"),
    currentWind: document.getElementById("current-wind"),
    currentHumidity: document.getElementById("current-humidity"),
    currentRain: document.getElementById("current-rain"),
    hourlySection: document.getElementById("hourly-section"),
    hourlyScroll: document.getElementById("hourly-scroll"),
    dailySection: document.getElementById("daily-section"),
    dailyGrid: document.getElementById("daily-grid"),
    updatedAt: document.getElementById("updated-at"),
    unitToggle: document.getElementById("unit-toggle"),
    themeToggle: document.getElementById("theme-toggle")
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

  function cToF(c) { return c * 9 / 5 + 32; }

  function fmtTemp(celsius) {
    var v = state.unit === "C" ? celsius : cToF(celsius);
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
    els.currentWind.textContent = Math.round(current.wind_speed_10m);
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
    fetch(API_URL)
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
      });
  }

  els.unitToggle.addEventListener("click", function () {
    state.unit = state.unit === "C" ? "F" : "C";
    els.unitToggle.textContent = "°" + state.unit;
    if (state.data) render(state.data);
  });

  load();
  setInterval(load, REFRESH_MS);
})();
