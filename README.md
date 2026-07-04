# Norwich Weather

**[Live demo →](https://askmark123.github.io/Askmark-/)**

A small static website showing the live weather forecast for Norwich, England, UK.

![Norwich Weather preview](assets/preview.png)

- Current conditions, next 24 hours, and a 7-day outlook
- Data from [Open-Meteo](https://open-meteo.com/) (no API key required), fetched live in the browser
- Plain HTML/CSS/JS, no build step, works offline of the fetch itself
- Light/dark theme aware, °C/°F toggle, auto-refreshes every 15 minutes

## Files

- `index.html` – page markup
- `style.css` – styling
- `script.js` – fetches the forecast and renders it

## Hosting on GitHub Pages

A workflow at `.github/workflows/pages.yml` deploys this site to GitHub Pages
automatically on every push to `main`. Requires repo **Settings → Pages →
Build and deployment → Source** set to **GitHub Actions**.

## Local preview

Just open `index.html` in a browser, or serve the folder with any static
file server, e.g. `python3 -m http.server`.
