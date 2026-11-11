# Blue Atlas — Global Intelligence Platform

Blue Atlas is a customized geospatial intelligence application based on [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) by Bilawal Sidhu.

## Development status

The initial branding changes are proposed in this branch. They do **not** establish that all live data feeds work on Vercel.

## Deployment checklist

1. Deploy the Vite build on Vercel with build command `npm run build` and output directory `dist`. Use a Node version satisfying `package.json` (24.14+ or 26).
2. Verify the globe renders in a clean browser session with no API keys.
3. Open browser developer tools → Network. Test `/api/` requests initiated by aircraft, vessel, news, weather, camera and AI features. A successful static build does not deploy the Vite middleware in `server/providers/local.js`.
4. Design a production API hosting strategy: Vercel Functions for suitable stateless endpoints; a separate persistent Node service for long-lived connections and durable caches where necessary.
5. Set provider credentials on the **server only**. Review which build-time keys are intentionally browser-visible before setting them.
6. Confirm source availability, freshness, error states, and rate limits for each layer before calling it live.
7. Regenerate all PNG icons using `node scripts/generate-icons.mjs` when the SVG logo changes, then commit those generated files.
8. Keep `LICENSE`, `THIRD_PARTY_NOTICES.md`, and the original author attribution. Audit `DATA_SOURCES.md` and `public/models/README.md` before public or commercial launch.

## License and dataset warnings

The upstream MIT license covers code, **not** all bundled datasets, images, and 3D models. In particular, TeleGeography submarine cable data and certain Bhote Koshi imagery are noncommercial. Remove or obtain appropriate rights before commercial deployment. Do not erase the upstream copyright notice.

## Initial scope

- Blue Atlas branding, metadata, and documentation
- A verified keyless map
- Working data sources and a production API plan
- Future phases: saved areas, alerts, AI briefings, custom dashboards

## Upstream attribution

Original project: [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view), copyright (c) 2026 Bilawal Sidhu. Source code used under MIT terms; see the repository `LICENSE` and third-party notices.
