  // ---- cloud profiles: Firebase Auth + Firestore, over REST ---------------------------
  // Keep your preset library against a Google account so it follows you between machines.
  //
  // NO FIREBASE SDK. Everything here is fetch() against three documented REST endpoints, so
  // the page stays a single self-contained file with no bundled dependency. The one remote
  // script is Google Identity Services, for the sign-in button — the same class of thing
  // initAnalytics() already loads (gtag.js), not a new one.
  //
  // The whole feature is gated on CONFIG.cloud.apiKey: empty ⇒ no script, no request, and the
  // Cloud row stays hidden. Identical kill switch to CONFIG.analyticsId.
  //
  // **The security boundary is firestore.rules in the repo root, not this file.** The web API
  // key below is public by design (it names the project; it authorises nothing), so anything
  // this file declines to do can still be attempted by hand. Client-side checks here are for
  // the user's benefit — clear errors, no pointless round trips — never for security.
  const CLOUD = CONFIG.cloud;
  const cloudOn = () => !!(CLOUD && CLOUD.apiKey && CLOUD.projectId);
  const CLOUD_KEY = "burnTheWeb.cloud.v1";     // its own localStorage key, NOT part of the scene blob
  const IDP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp";
  const TOKEN_URL = "https://securetoken.googleapis.com/v1/token";
  const GIS_SRC = "https://accounts.google.com/gsi/client";
  const docUrl = uid => "https://firestore.googleapis.com/v1/projects/" + CLOUD.projectId
    + "/databases/(default)/documents/profiles/" + encodeURIComponent(uid);

  // Session: uid + the two tokens + when the short-lived one expires. Refresh tokens live in
  // localStorage, which any XSS on the page could read — standard for a static app, and the
  // blast radius is one user's presets, but it is a real trade and worth knowing.
  let cloudSess = null;
  function cloudLoadSess() {
    try { cloudSess = JSON.parse(localStorage.getItem(CLOUD_KEY) || "null"); }
    catch (e) { cloudSess = null; }
    if (cloudSess && !cloudSess.refreshToken) cloudSess = null;
  }
  function cloudSaveSess() {
    try {
      if (cloudSess) localStorage.setItem(CLOUD_KEY, JSON.stringify(cloudSess));
      else localStorage.removeItem(CLOUD_KEY);
    } catch (e) { /* private mode — session just won't survive the reload */ }
  }

  // ---- Firestore typed values ----
  // The REST API wraps every field in its type: {"stringValue":…}, {"integerValue":"7"} —
  // integers really are strings on the wire, which is the one genuinely surprising bit. This
  // stays a dozen lines ONLY because a profile is five scalar fields; the preset library
  // itself rides as one already-compressed string (see cloudPayload below) rather than being
  // mapped into Firestore structure, which would mean re-encoding the whole preset schema.
  function fsOut(o) {
    const f = {};
    for (const k in o) {
      const v = o[k];
      if (typeof v === "string") f[k] = { stringValue: v };
      else if (typeof v === "boolean") f[k] = { booleanValue: v };
      else if (typeof v === "number") f[k] = Number.isInteger(v)
        ? { integerValue: String(v) } : { doubleValue: v };
      else if (v instanceof Date) f[k] = { timestampValue: v.toISOString() };
    }
    return { fields: f };
  }
  function fsIn(doc) {
    const out = {};
    const f = (doc && doc.fields) || {};
    for (const k in f) {
      const v = f[k];
      if ("stringValue" in v) out[k] = v.stringValue;
      else if ("booleanValue" in v) out[k] = v.booleanValue;
      else if ("integerValue" in v) out[k] = +v.integerValue;
      else if ("doubleValue" in v) out[k] = +v.doubleValue;
      else if ("timestampValue" in v) out[k] = v.timestampValue;
      else if ("nullValue" in v) out[k] = null;
    }
    return out;
  }

  // ---- tokens ----
  // Firebase id tokens last about an hour. Refresh 60s early so a save can't fail on a token
  // that expired between the check and the request landing.
  function cloudFresh() {
    if (!cloudSess) return Promise.reject(new Error("not signed in"));
    if (cloudSess.idToken && Date.now() < (cloudSess.expires || 0) - 60000) {
      return Promise.resolve(cloudSess.idToken);
    }
    return fetch(TOKEN_URL + "?key=" + encodeURIComponent(CLOUD.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(cloudSess.refreshToken),
    }).then(r => (r.ok ? r.json() : Promise.reject(new Error("refresh failed (" + r.status + ")"))))
      .then(j => {
        cloudSess.idToken = j.id_token;
        cloudSess.refreshToken = j.refresh_token || cloudSess.refreshToken;
        cloudSess.expires = Date.now() + (+j.expires_in || 3600) * 1000;
        cloudSess.uid = j.user_id || cloudSess.uid;
        cloudSaveSess();
        return cloudSess.idToken;
      })
      .catch(e => {                       // a dead refresh token is permanent — sign out cleanly
        cloudSignOut();
        throw e;
      });
  }
  // One authorised Firestore call. A 401 mid-flight means the token died early (revoked, or a
  // clock skew) — refresh ONCE and retry, never loop, or a genuinely rejected token spins.
  function cloudFetch(url, opts, retried) {
    return cloudFresh().then(tok => fetch(url, {
      ...opts,
      headers: { ...(opts && opts.headers), "Content-Type": "application/json", Authorization: "Bearer " + tok },
    })).then(r => {
      if (r.status === 401 && !retried) {
        cloudSess.expires = 0;            // force the refresh, then one more attempt
        return cloudFetch(url, opts, true);
      }
      return r;
    });
  }

  // ---- sign in / out ----
  function cloudSignIn(googleIdToken) {
    return fetch(IDP_URL + "?key=" + encodeURIComponent(CLOUD.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: "id_token=" + encodeURIComponent(googleIdToken) + "&providerId=google.com",
        requestUri: location.origin,
        returnSecureToken: true,
      }),
    }).then(r => (r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(t || ("HTTP " + r.status))))))
      .then(j => {
        cloudSess = {
          uid: j.localId,
          idToken: j.idToken,
          refreshToken: j.refreshToken,
          expires: Date.now() + (+j.expiresIn || 3600) * 1000,
        };
        cloudSaveSess();
        track("cloud_sign_in", {});
        cloudSyncUI();
        cloudFetchProfileMeta();          // pick up the profile name, if there is one already
      });
  }
  function cloudSignOut() {
    cloudSess = null;
    cloudSaveSess();
    cloudSyncUI();
  }

  // ---- the payload ----
  // Exactly the blob a preset-bundle link carries (libraryUrl), through exactly the same
  // codec — so one encoder and one decoder serve both, and a cloud profile and a #zp= link
  // are the same bytes. That is what keeps this feature small and what makes the existing
  // decode path (openSharedLibrary) able to consume a downloaded profile unchanged.
  function cloudBlob() {
    autosavePreset();                     // fold pending edits into the selected preset first
    const snap = fullSnapshot();
    const blob = { presets: snap.presets, cycle: snap.cycle };
    if (snap.curPreset >= 0) blob.curPreset = snap.curPreset;
    return serializeBlob(blob);
  }

  // ---- save / load / delete ----
  function cloudSave() {
    if (!cloudSess) return;
    const blob = cloudBlob();
    const n = (blob.presets || []).length;
    if (!n) { cloudMsg("Nothing to save — you have no presets yet.", true); return; }
    cloudMsg("Saving…");
    zipToB64(JSON.stringify(blob)).then(payload => {
      if (payload == null) throw new Error("this browser cannot compress the payload");
      if (payload.length >= CLOUD.maxPayload) {
        throw new Error("library too big to store (" + Math.round(payload.length / 1024) + " KB)");
      }
      const body = fsOut({
        name: (el("cloud-name").value || "").trim().slice(0, 40) || "burnTheWeb",
        payload,
        count: n,
        pub: !!(cloudSess && cloudSess.pub),
        updated: new Date(),
      });
      // Name every field in the mask so the write is a deterministic full replace rather than
      // a merge onto whatever happens to be there — the rules' hasOnly() check is against the
      // RESULTING document, so a stray leftover field would fail the write.
      const mask = ["name", "payload", "count", "pub", "updated"]
        .map(f => "updateMask.fieldPaths=" + f).join("&");
      return cloudFetch(docUrl(cloudSess.uid) + "?" + mask, { method: "PATCH", body: JSON.stringify(body) });
    }).then(r => {
      if (!r.ok) return r.text().then(t => Promise.reject(new Error(cloudErr(t, r.status))));
      cloudMsg("Saved " + n + " preset" + (n === 1 ? "" : "s") + " to your profile.");
      track("cloud_save", { count: n });
    }).catch(e => cloudMsg("Could not save: " + e.message, true));
  }

  function cloudLoad() {
    if (!cloudSess) return;
    cloudMsg("Loading…");
    cloudFetch(docUrl(cloudSess.uid), { method: "GET" }).then(r => {
      if (r.status === 404) return Promise.reject(new Error("you have not saved a profile yet"));
      if (!r.ok) return r.text().then(t => Promise.reject(new Error(cloudErr(t, r.status))));
      return r.json();
    }).then(doc => {
      const d = fsIn(doc);
      if (!d.payload) throw new Error("that profile is empty");
      return unzipFromB64(d.payload);
    }).then(json => {
      if (json == null) throw new Error("could not read the stored payload");
      let raw;
      try { raw = JSON.parse(json); } catch (e) { throw new Error("stored payload is corrupt"); }
      cloudMsg("");
      // Straight into the existing shared-library path: validation, the merge-vs-replace
      // Restore dialog, and landing on the stored selected preset all come for free.
      openSharedLibrary(raw);
      track("cloud_load", {});
    }).catch(e => cloudMsg("Could not load: " + e.message, true));
  }

  function cloudDelete() {
    if (!cloudSess) return;
    if (!confirm("Delete your cloud profile permanently? Your presets in this browser are not touched.")) return;
    cloudMsg("Deleting…");
    cloudFetch(docUrl(cloudSess.uid), { method: "DELETE" }).then(r => {
      if (!r.ok && r.status !== 404) return r.text().then(t => Promise.reject(new Error(cloudErr(t, r.status))));
      cloudMsg("Profile deleted.");
      track("cloud_delete", {});
    }).catch(e => cloudMsg("Could not delete: " + e.message, true));
  }

  // Read just the metadata after signing in, so the name field shows what is already stored
  // rather than starting blank and overwriting it on the next save.
  function cloudFetchProfileMeta() {
    if (!cloudSess) return;
    cloudFetch(docUrl(cloudSess.uid) + "?mask.fieldPaths=name&mask.fieldPaths=count&mask.fieldPaths=pub",
      { method: "GET" }).then(r => (r.ok ? r.json() : null)).then(doc => {
        if (!doc) return;
        const d = fsIn(doc);
        if (d.name && el("cloud-name")) el("cloud-name").value = d.name;
        if (cloudSess) cloudSess.pub = !!d.pub;
        if (d.count != null) cloudMsg("Profile has " + d.count + " preset" + (d.count === 1 ? "" : "s") + " stored.");
      }).catch(() => { /* no profile yet — nothing to show */ });
  }

  // Firestore returns a JSON error envelope; surface its message rather than a bare status,
  // because "Missing or insufficient permissions" is the one users will actually hit.
  function cloudErr(text, status) {
    try {
      const j = JSON.parse(text);
      if (j && j.error && j.error.message) return j.error.message;
    } catch (e) { /* not JSON */ }
    return "HTTP " + status;
  }

  // ---- UI ----
  function cloudMsg(s, bad) {
    const m = el("cloud-msg");
    if (!m) return;
    m.textContent = s || "";
    m.style.color = bad ? "#ff8b6a" : "";
  }
  function cloudSyncUI() {
    if (!cloudOn()) return;
    const inS = !!cloudSess;
    const authed = el("cloud-authed"), signin = el("cloud-signin"), who = el("cloud-who");
    if (authed) authed.style.display = inS ? "" : "none";
    if (signin) signin.style.display = inS ? "none" : "";
    if (who) who.textContent = inS ? "· signed in" : "";
    if (!inS) cloudMsg("");
  }

  // Google Identity Services renders the sign-in button and hands back a Google ID token,
  // which cloudSignIn trades for a Firebase session. Loaded lazily and ONLY when configured,
  // so an unconfigured build makes no third-party request at all.
  function cloudInit() {
    if (!cloudOn()) return;              // feature off ⇒ the row stays hidden, nothing loads
    const row = el("cloudrow");
    if (row) row.classList.remove("hidden");
    cloudLoadSess();
    cloudSyncUI();
    if (cloudSess) cloudFetchProfileMeta();
    if (!CLOUD.clientId) { cloudMsg("Sign-in is not configured for this build.", true); return; }
    const s = document.createElement("script");
    s.src = GIS_SRC; s.async = true; s.defer = true;
    s.onload = () => {
      try {
        window.google.accounts.id.initialize({
          client_id: CLOUD.clientId,
          callback: res => {
            if (!res || !res.credential) return;
            cloudMsg("Signing in…");
            cloudSignIn(res.credential).catch(e => cloudMsg("Sign-in failed: " + e.message, true));
          },
        });
        window.google.accounts.id.renderButton(el("cloud-signin"), { theme: "filled_black", size: "medium", text: "signin_with" });
      } catch (e) { cloudMsg("Sign-in unavailable: " + e.message, true); }
    };
    s.onerror = () => cloudMsg("Could not reach Google sign-in.", true);
    document.head.appendChild(s);
  }

  if (el("cloud-save")) el("cloud-save").addEventListener("click", cloudSave);
  if (el("cloud-load")) el("cloud-load").addEventListener("click", cloudLoad);
  if (el("cloud-delete")) el("cloud-delete").addEventListener("click", cloudDelete);
  if (el("cloud-signout")) el("cloud-signout").addEventListener("click", cloudSignOut);
  cloudInit();
