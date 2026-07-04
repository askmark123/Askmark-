# Norwich Weather

A small static website showing the live weather forecast for Norwich, England, UK.

- Current conditions, next 24 hours, and a 7-day outlook
- Data from [Open-Meteo](https://open-meteo.com/) (no API key required), fetched live in the browser
- Plain HTML/CSS/JS, no build step, works offline of the fetch itself
- Light/dark theme aware

## Files

- `index.html` – page markup
- `style.css` – styling
- `script.js` – fetches the forecast and renders it

## Hosting on GitHub Pages

A workflow at `.github/workflows/pages.yml` deploys this site to GitHub Pages
automatically on every push to `main`. To turn it on the first time:

1. Go to the repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or re-run the "Deploy Norwich Weather site to GitHub Pages"
   workflow from the **Actions** tab) — the site will be published at
   `https://<owner>.github.io/<repo>/`.

## Local preview

Just open `index.html` in a browser, or serve the folder with any static
file server, e.g. `python3 -m http.server`.
