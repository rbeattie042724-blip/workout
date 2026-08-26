# Split Ledger

A phone-first workout dashboard: a 4-day full-body split with a strength and an
athletic option for every day, a calendar planner, and a set-by-set logger.
Everything is stored in the browser on your device — no account, no server.

Single self-contained page (`index.html`), plus an icon set, a web app manifest,
and a service worker so it keeps working with no signal at the gym.

## Publish it to GitHub Pages

1. Create an empty repo at <https://github.com/new> named `workout`.
   Leave "Add a README" unchecked.
2. From this folder, push:

   ```
   git remote add origin https://github.com/YOUR-USERNAME/workout.git
   git branch -M main
   git push -u origin main
   ```

3. In the repo, go to **Settings → Pages**, set **Source** to
   *Deploy from a branch*, branch **main**, folder **/ (root)**, and Save.
4. A minute later it's live at
   `https://YOUR-USERNAME.github.io/workout/`.

## Put it on your phone

Open that URL in Safari → Share → **Add to Home Screen**. It launches
full-screen with no address bar and no banners, and works offline.

## Your data

Logs live in the browser's local storage, scoped to the site and the browser.
Settings → **Export backup** writes a JSON file; **Import** restores it. Use that
to move between devices, and before clearing website data.

## Updating

Edit `index.html`, then `git commit` and `git push`. Bump `CACHE` in `sw.js`
when you want existing installs to drop their cached copy immediately.
