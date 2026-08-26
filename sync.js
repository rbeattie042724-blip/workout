/* ══════════════════════════════════════════════════════════════════════════
   Split Ledger — optional account sync (Firebase Auth + Cloud Firestore).

   Paste your project's config below and sync switches itself on. Leave it as
   it is and the dashboard runs exactly as before, saving to this device only.
   These values are public identifiers, not secrets — a Firebase web config is
   meant to ship in the page. Access is controlled by the Firestore rules in
   README.md, which only ever let a signed-in person touch their own document.
   ══════════════════════════════════════════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey:            "PASTE_API_KEY",
  authDomain:        "PASTE_PROJECT_ID.firebaseapp.com",
  projectId:         "PASTE_PROJECT_ID",
  storageBucket:     "PASTE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId:             "PASTE_APP_ID"
};

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
const configured = !String(FIREBASE_CONFIG.apiKey).startsWith('PASTE_');

/* Nothing to do: leave the app in its device-only state. */
if(!configured || !window.SL){
  if(window.SL) window.SL.setAuth({status:'off'});
} else {
  boot().catch(err => {
    console.error('[sync]', err);
    window.SL.setAuth({status:'out', error:'Sync could not start. Check your connection and reload.'});
  });
}

async function boot(){
  const [{ initializeApp }, auth, store] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`)
  ]);

  const app = initializeApp(FIREBASE_CONFIG);
  const A = auth.getAuth(app);
  const db = store.getFirestore(app);
  A.useDeviceLanguage();

  const CLIENT = Math.random().toString(36).slice(2, 10);   // this device, this session
  let user = null, ref = null, stop = null;
  let pushTimer = null, pushing = false, dirty = false, lastSync = 0;

  const status = (s, extra) => window.SL.setAuth(
    Object.assign({status:s, email:user ? (user.email || 'signed in') : '', lastSync}, extra||{}));

  /* ── auth ────────────────────────────────────────────────────────────── */
  const provider = new auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});

  async function google(){
    status('busy');
    try{
      await auth.signInWithPopup(A, provider);
    }catch(err){
      // iOS Safari and in-app browsers block popups; fall back to a redirect.
      if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment',
          'auth/cancelled-popup-request'].includes(err.code)){
        try{ await auth.signInWithRedirect(A, provider); return; }catch(e2){ return fail(e2); }
      }
      if(err.code === 'auth/popup-closed-by-user'){ status('out'); return; }
      fail(err);
    }
  }

  async function email(mode, addr, pass){
    if(!addr || !pass){ status('out', {error:'Enter your email and a password.'}); return; }
    if(mode === 'up' && pass.length < 6){
      status('out', {error:'Passwords need at least 6 characters.'}); return;
    }
    status('busy');
    try{
      if(mode === 'up') await auth.createUserWithEmailAndPassword(A, addr, pass);
      else              await auth.signInWithEmailAndPassword(A, addr, pass);
    }catch(err){ fail(err); }
  }

  async function reset(addr){
    if(!addr){ status('out', {error:'Enter your email address first, then tap this again.'}); return; }
    try{
      await auth.sendPasswordResetEmail(A, addr);
      status('out', {error:''});
      window.SL.toast('Reset link sent — check your email.');
    }catch(err){ fail(err); }
  }

  async function signOut(){
    if(stop){ stop(); stop = null; }
    try{ await auth.signOut(A); }catch(e){}
    user = null; ref = null; lastSync = 0;
    status('out');
    window.SL.toast('Signed out — this device keeps its copy.');
  }

  function fail(err){
    console.warn('[sync]', err && err.code, err && err.message);
    status('out', {error: readable(err)});
  }

  function readable(err){
    switch(err && err.code){
      case 'auth/invalid-email':          return 'That email address does not look right.';
      case 'auth/missing-password':       return 'Enter your password.';
      case 'auth/weak-password':          return 'Passwords need at least 6 characters.';
      case 'auth/email-already-in-use':   return 'That email already has an account — sign in instead.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':         return 'Wrong email or password.';
      case 'auth/too-many-requests':      return 'Too many attempts. Wait a minute and try again.';
      case 'auth/network-request-failed': return 'No connection. Your training is still saved on this device.';
      case 'auth/unauthorized-domain':    return 'This site is not in the Firebase authorised domains list yet.';
      case 'auth/operation-not-allowed':  return 'That sign-in method is switched off in the Firebase console.';
      case 'permission-denied':           return 'The database rules are rejecting this. Check the Firestore rules.';
      default: return (err && err.message) ? err.message.replace(/^Firebase:\s*/, '') : 'Something went wrong.';
    }
  }

  /* ── sync ────────────────────────────────────────────────────────────── */
  function push(){
    if(!ref) return;
    dirty = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flush, 1500);
  }

  async function flush(){
    if(!ref || pushing || !dirty) return;
    pushing = true; dirty = false;
    const body = window.SL.snapshot();
    try{
      await store.setDoc(ref, Object.assign({}, body, {client:CLIENT, syncedAt: store.serverTimestamp()}));
      lastSync = Date.now();
      status('in');
    }catch(err){
      dirty = true;                                  // try again on the next save
      console.warn('[sync] push failed', err);
    }finally{
      pushing = false;
    }
  }

  async function syncNow(){
    if(!ref) return;
    status('busy');
    try{
      const snap = await store.getDoc(ref);
      if(snap.exists()) adopt(snap.data());
      dirty = true; await flush();
      window.SL.toast('Synced');
    }catch(err){ fail(err); }
  }

  function adopt(remote){
    const merged = window.SL.merge(remote || {}, window.SL.snapshot());
    window.SL.adopt(merged);
  }

  async function attach(u){
    user = u;
    ref = store.doc(db, 'ledgers', u.uid);
    status('busy');
    try{
      const snap = await store.getDoc(ref);
      adopt(snap.exists() ? snap.data() : {});        // first sign-in pushes this device up
      dirty = true; await flush();
    }catch(err){ fail(err); return; }

    if(stop) stop();
    stop = store.onSnapshot(ref, snap => {
      const d = snap.data();
      if(!d || d.client === CLIENT) return;           // ignore the echo of our own write
      adopt(d);
      lastSync = Date.now();
      status('in');
    }, err => console.warn('[sync] listener', err));
  }

  window.SL.api = {google, email, reset, signOut, syncNow, push};

  auth.onAuthStateChanged(A, u => {
    if(u) attach(u);
    else { if(stop){ stop(); stop = null; } user = null; ref = null; status('out'); }
  });

  // finishing a redirect sign-in resolves here
  auth.getRedirectResult(A).catch(err => { if(err && err.code) fail(err); });

  status('out');
}
