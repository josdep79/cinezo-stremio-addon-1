# Cinezo Catalog for Stremio

This is a community add-on starter that exposes Cinezo's public movie and series listings as Stremio catalogs. Selecting **Open on Cinezo** opens the corresponding Cinezo title page in the system browser.

It does **not** extract, proxy, or play video streams. It is a catalog/link-out add-on only.

## Run locally

Requirements: Node.js 18+

```bash
npm install
npm start
```

Then open this manifest in Stremio:

```text
http://localhost:7000/manifest.json
```

Localhost installation is useful only on the same device running the add-on. For use on other devices, deploy the project to a server with a public HTTPS address, then install:

```text
https://YOUR-HOST/manifest.json
```

## Deploy

Deploy this folder to a Node.js host (for example, a VPS or a Node-compatible application host). Set:

- `PORT` to the port supplied by the host.
- `CINEZO_BASE_URL` optionally, default `https://cinezo.gd`.

The host must provide HTTPS for reliable installation and use across devices.

## Notes / limitations

- Cinezo's current public page URLs observed by the author use `/movie/{id}` and `/tv/{id}`.
- Catalog parsing is based on the site's public HTML and may need adjustment if Cinezo changes its page markup, pagination, or search route.
- Search currently tries `/search?query=...`; Cinezo's search is client-rendered, so search may need a follow-up adjustment if the site does not expose results at that route.
- The add-on cannot make Cinezo playable inside Stremio's native player. It deliberately links out to Cinezo's page.
- Use only where access to the linked content is lawful in your location.
