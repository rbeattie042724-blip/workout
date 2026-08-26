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

## Optional accounts (free)

Sync is off until you paste a Firebase config into `sync.js`. Without one the
dashboard runs device-only, exactly as before. With one, anyone can sign in and
their training follows them to any device. Firebase's free Spark plan covers
this comfortably and does not expire.

1. **Create the project.** <https://console.firebase.google.com> → *Add project*.
   Name it anything; you can turn Analytics off.
2. **Turn on sign-in.** *Build → Authentication → Get started → Sign-in method*.
   Enable **Email/Password** and **Google**.
3. **Authorise the site.** *Authentication → Settings → Authorized domains* →
   *Add domain* → `rbeattie042724-blip.github.io`. (`localhost` is already there.)
4. **Create the database.** *Build → Firestore Database → Create database* →
   **Production mode** → pick the region closest to you.
5. **Paste the rules.** Firestore → *Rules* tab → replace everything with this,
   then *Publish*. It lets each signed-in person read and write their own
   document and nothing else:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /ledgers/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

6. **Copy the config.** Gear icon → *Project settings* → *Your apps* → the web
   icon `</>` → register the app → copy the `firebaseConfig` object.
7. **Paste it** into `FIREBASE_CONFIG` at the top of `sync.js`, then push.

Those config values are public identifiers, not secrets — a Firebase web config
is designed to ship inside the page. The rules above are what actually protect
the data, which is why step 5 matters.

### How syncing behaves

- Signing in is optional; signed out, everything works and stays on the device.
- The device copy is always the working copy, so the app is fully usable offline
  at the gym. Changes push up about a second after they settle.
- Signing in on a new device merges rather than overwrites: sessions and custom
  workouts are unioned by id, and deletions are remembered so they do not come
  back from another device.
- Two devices open at once see each other's changes live.

## Your data

Logs live in the browser's local storage, scoped to the site and the browser.
Settings → **Export backup** writes a JSON file; **Import** restores it. Use that
to move between devices, and before clearing website data.

## Updating

Edit `index.html`, then `git commit` and `git push`. Bump `CACHE` in `sw.js`
when you want existing installs to drop their cached copy immediately.
