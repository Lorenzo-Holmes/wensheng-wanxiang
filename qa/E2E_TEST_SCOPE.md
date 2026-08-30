# V2 Chromium E2E coverage

This suite runs only in GitHub Actions and does not enter the Xiaohongshu production package.

Automated coverage:

- 320 / 375 / 390 px mobile viewports
- zero horizontal overflow
- closed Bottom Sheet remains outside the visible viewport
- pointer drawing -> pointer-up -> automatic generation
- first result latency budget (< 2s hard CI guard; observed ~566ms)
- WX2-C composition code copy
- quick motif switching
- custom rule editing and local save
- curated instant palette and local save
- custom motif drawing, tiled preview and local save
- favorite -> local atlas
- WX2-H same-stroke challenge share
- composition import -> immediate Remix
- 900x1200 PNG export/download
- legacy WW Seed import -> WX2-C migration
- atlas persistence across page reload
- page/console error capture
- Long Task observation during automated flows

The production runtime remains framework-free and npm-free. Playwright is installed transiently in CI only.
