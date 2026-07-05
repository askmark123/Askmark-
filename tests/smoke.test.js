const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

test("forecast API returns expected shape for the default location (Norwich)", async () => {
  const url = "https://api.open-meteo.com/v1/forecast" +
    "?latitude=52.6286&longitude=1.2926" +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,is_day" +
    "&hourly=temperature_2m,precipitation_probability,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=auto&forecast_days=7";

  const res = await fetch(url);
  assert.equal(res.ok, true, "forecast API should respond OK");
  const data = await res.json();

  assert.ok(data.current, "response should include current conditions");
  assert.equal(typeof data.current.temperature_2m, "number");
  assert.ok(Array.isArray(data.hourly.time) && data.hourly.time.length > 0);
  assert.ok(Array.isArray(data.daily.time) && data.daily.time.length === 7);
});

test("geocoding API returns UK matches for a known town name", async () => {
  const url = "https://geocoding-api.open-meteo.com/v1/search?name=Norwich&count=5&language=en&format=json&countryCode=GB";

  const res = await fetch(url);
  assert.equal(res.ok, true);
  const data = await res.json();

  assert.ok(Array.isArray(data.results) && data.results.length > 0, "expected at least one UK result");
  for (const key of ["name", "latitude", "longitude", "country"]) {
    assert.ok(key in data.results[0], 'result missing "' + key + '"');
  }
  assert.equal(data.results[0].country_code, "GB");
});

test("Nominatim reverse geocoding returns address details for a UK point", async () => {
  const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=52.6286&lon=1.2926&zoom=10&addressdetails=1";

  const res = await fetch(url, { headers: { "User-Agent": "AskmarkWeatherTests/1.0 (CI smoke test)" } });
  assert.equal(res.ok, true);
  const data = await res.json();

  assert.ok(data.address, "response should include an address block");
  assert.ok(data.address.city || data.address.town, "expected a city/town in the address");
});

test("every DOM id referenced in script.js exists in index.html", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");

  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const referencedIds = [...js.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);

  assert.ok(referencedIds.length > 0, "expected script.js to reference some element ids");
  for (const id of referencedIds) {
    assert.ok(htmlIds.has(id), 'index.html is missing an element with id="' + id + '"');
  }
});
