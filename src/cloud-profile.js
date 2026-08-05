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
  // YOUR SCENES ONLY. A collection you loaded from the gallery is somebody else's work that
  // you are holding locally; uploading it would put a second copy in your document, count it
  // on your gallery card, and hand it on again to anyone who loads you — three wrongs from one
  // line. `collection` is exactly the "not mine" marker (a scene of your own never carries
  // one), so that field is the whole filter.
  //
  // What DOES ride is the fact that you added them: `collections` is the list of collections
  // you hold, names and source uids, no scenes. Their work stays theirs to publish and stays
  // in this browser's localStorage, which is where a reading list belongs.
  //
  // curPreset is an INDEX INTO THE ARRAY BEING SENT, so it is remapped rather than copied —
  // and it falls back to 0 when the scene you are sitting on is one of the borrowed ones,
  // which would otherwise point past the end or at a stranger's scene.
  function cloudBlob() {
    autosavePreset();                     // fold pending edits into the selected preset first
    const snap = fullSnapshot();
    const mine = [];
    let cur = -1;
    (snap.presets || []).forEach((p, i) => {
      if (collectionOf(p)) return;
      if (i === snap.curPreset) cur = mine.length;
      mine.push(p);
    });
    const blob = { presets: mine, cycle: snap.cycle, collections: snap.collections };
    if (mine.length) blob.curPreset = cur >= 0 ? cur : 0;
    return serializeBlob(blob);
  }

  // ---- save / load / delete ----
  function cloudSave() {
    if (!cloudSess) return;
    const blob = cloudBlob();
    const n = (blob.presets || []).length;
    // Your library can be non-empty and still have nothing to send: every scene in it came
    // from someone else's collection, and those are not yours to store.
    if (!n) {
      cloudMsg(presets.length
        ? "Nothing to save — every scene you hold belongs to someone else's collection."
        : "Nothing to save — you have no scenes yet.", true);
      return;
    }
    cloudMsg("Saving…");
    zipToB64(JSON.stringify(blob)).then(payload => {
      if (payload == null) throw new Error("this browser cannot compress the payload");
      if (payload.length >= CLOUD.maxPayload) {
        throw new Error("library too big to store (" + Math.round(payload.length / 1024) + " KB)");
      }
      const body = fsOut({
        name: myProfileName() || DEFAULT_PROFILE_NAME,   // same default the list heading shows
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
      cloudMsg("Saved " + n + " scene" + (n === 1 ? "" : "s") + " to your profile.");
      track("cloud_save", { count: n });
    }).catch(e => cloudMsg("Could not save: " + e.message, true));
  }

  // THE ONE PLACE A STORED PAYLOAD BECOMES A LIBRARY. `cloudLoad` is the only caller today —
  // the history restore that was the second one is gone — and the seam is kept anyway, which
  // is the point of it: the NEXT transport that needs to turn a stored payload into a library
  // has to come through here rather than growing a private decoder. That is the whole reason a
  // cloud payload is the same bytes as a #zp= bundle. cloudprobe asserts this structurally.
  function cloudApplyPayload(payload) {
    return unzipFromB64(payload).then(json => {
      if (json == null) throw new Error("could not read the stored payload");
      let raw;
      try { raw = JSON.parse(json); } catch (e) { throw new Error("stored payload is corrupt"); }
      // Put the collections you follow back before anything is applied — see below for why
      // here and not after the reload.
      return refollowCollections(raw);
    }).then(res => {
      // A source that went away is worth saying out loud, and it must survive the clear —
      // the Restore dialog is cancellable, so this is not always a message nobody reads.
      cloudMsg(res.missed.length ? "Could not fetch " + res.missed.join(", ") + " — the rest loaded." : "",
               res.missed.length > 0);
      // Straight into the existing shared-library path: validation, the merge-vs-replace
      // Restore dialog, and landing on the stored selected preset all come for free.
      openSharedLibrary(res.raw);
    });
  }
  // Re-follow the collections this profile records. A profile stores WHO you added, never
  // their scenes (see cloudBlob), so without this a load on a second machine arrives with your
  // own scenes and a follow-list that renders as nothing at all.
  //
  // Fetched HERE, and appended to the SAME preset array, so the whole load is still ONE
  // applyRestore and ONE reload. The obvious alternative — re-adding them after the reload —
  // cannot work as cheaply: the install path (applySharedLibrary → applyRestore) ends in
  // location.reload(), so N collections would be N reloads.
  //
  // APPENDED, never prepended: `curPreset` indexes this array, and anything inserted ahead of
  // it would silently slide the sender's selection onto a different scene.
  //
  // A source that has been deleted, unpublished, emptied or corrupted is SKIPPED and named in
  // the message. Someone else's profile going away must never fail the load of your own
  // scenes — and the record survives, so it comes back if they do.
  //
  // Sequential rather than parallel: the list is short (collectionsOk caps it at 40), and one
  // request at a time keeps a slow or failing source from being blamed on the others.
  function refollowCollections(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.presets)) return Promise.resolve({ raw, missed: [] });
    const want = collectionsOk(raw.collections);
    // Anything already present in the payload is left alone. Nothing writes a collection into
    // a profile today, but an older blob (saved before cloudBlob started filtering) carries
    // them, and re-fetching those would duplicate the set rather than refresh it.
    const have = new Set(raw.presets.map(p => (p && p.collection) || "").filter(Boolean));
    const todo = want.filter(c => c.uid && !have.has(c.key));
    if (!todo.length) return Promise.resolve({ raw, missed: [] });
    cloudMsg("Fetching " + todo.length + " collection" + (todo.length === 1 ? "" : "s") + "…");
    const missed = [];
    return todo.reduce((chain, c) => chain.then(() =>
      galFetchLibrary(c.uid).then(lib => {
        const arr = (lib && Array.isArray(lib.presets)) ? lib.presets : [];
        // Stamped with the label YOU follow them under, exactly as the gallery install does —
        // their own borrowed scenes (an older profile could carry some) must not come through
        // wearing a third party's name.
        for (const p of arr) if (p && typeof p === "object") raw.presets.push({ ...p, collection: c.key });
      }).catch(() => { missed.push(c.key); })
    ), Promise.resolve()).then(() => ({ raw, missed }));
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
      return cloudApplyPayload(d.payload);
    }).then(() => {
      track("cloud_load", {});
    }).catch(e => cloudMsg("Could not load: " + e.message, true));
  }

  function cloudDelete() {
    if (!cloudSess) return;
    if (!confirm("Delete your cloud profile permanently? Your scenes in this browser are not touched.")) return;
    cloudMsg("Deleting…");
    // FIRESTORE DOES NOT CASCADE. Deleting a document leaves its subcollections completely
    // intact — they simply hang off a path with nothing at it, still stored, still billed,
    // still readable by their owner. So any leftover history has to be swept explicitly, and
    // BEFORE the profile goes: if the sweep fails we still have a profile to point the user
    // at, whereas deleting the parent first would strand the snapshots with no UI left to
    // reach them from. (Version history is retired — see snapDeleteAll for why this stays.)
    snapDeleteAll()
      .then(() => cloudFetch(docUrl(cloudSess.uid), { method: "DELETE" }))
      .then(r => {
        if (!r.ok && r.status !== 404) return r.text().then(t => Promise.reject(new Error(cloudErr(t, r.status))));
        cloudMsg("Profile deleted.");
        track("cloud_delete", {});
      }).catch(e => cloudMsg("Could not delete: " + e.message, true));
  }
  // ---- leftover version-history sweep ------------------------------------------------
  // Version history shipped in 1.13.0 and was removed in 1.13.1, which took out every client
  // path that could DELETE a snapshot — while the rules still permit the owner to, precisely
  // so the cleanup remains possible. Anything written during that window is a full copy of a
  // whole scene library, and without this it survives a "Delete profile" that reports success,
  // permanently unreachable AND undeletable from the app.
  //
  // Nothing writes these any more, so this is one-way: it only ever removes. Recovered from
  // the pre-removal code rather than rewritten. Retire it together with the
  // `/profiles/{uid}/snapshots` block in firestore.rules once the console is confirmed clean.
  //
  // Deliberately SILENT on the common path: a profile that never had a subcollection lists
  // empty (or 404s) and deletes exactly as before, with no mention of a feature its owner may
  // never have seen.
  const snapCollUrl = uid => docUrl(uid) + "/snapshots";
  const snapDocUrl = (uid, sid) => snapCollUrl(uid) + "/" + encodeURIComponent(sid);
  // Ids only, in effect: the mask keeps every stored library off the wire, the same reason
  // galQuery projects `payload` away. **404 is an empty list, not an error** — that is the
  // overwhelmingly common case, a profile with no subcollection at all, and treating it as a
  // failure would block every ordinary delete.
  //
  // No pagination loop: 1.13.0 kept at most `snapshotKeep` (14) and was live for a single day,
  // so one page of 300 cannot be short.
  function snapList() {
    if (!cloudSess) return Promise.resolve([]);
    return cloudFetch(snapCollUrl(cloudSess.uid) + "?mask.fieldPaths=count&pageSize=300", { method: "GET" })
      .then(r => (r.ok ? r.json()
        : (r.status === 404 ? {} : r.text().then(t => Promise.reject(new Error(cloudErr(t, r.status)))))))
      .then(j => ((j && j.documents) || []).map(doc => String(doc.name || "").split("/").pop()).filter(Boolean));
  }
  function snapDelete(id) {
    return cloudFetch(snapDocUrl(cloudSess.uid, id), { method: "DELETE" })
      .then(r => (r.ok || r.status === 404 ? null
        : r.text().then(t => Promise.reject(new Error(cloudErr(t, r.status))))));
  }
  function snapDeleteAll() {
    if (!cloudSess) return Promise.resolve();
    return snapList().then(ids => Promise.all(ids.map(snapDelete)));
  }

  // Read just the metadata after signing in, so the name field shows what is already stored
  // rather than starting blank and overwriting it on the next save.
  function cloudFetchProfileMeta() {
    if (!cloudSess) return;
    cloudFetch(docUrl(cloudSess.uid) + "?mask.fieldPaths=name&mask.fieldPaths=count&mask.fieldPaths=pub",
      { method: "GET" }).then(r => (r.ok ? r.json() : null)).then(doc => {
        if (!doc) return;
        const d = fsIn(doc);
        // Through setProfileName, so the cache and the scene-list heading follow. This is the
        // async arrival the cache exists to pre-empt — on a first-ever sign-in it is the only
        // thing that puts your name on the list, and it must not wait for a rebuild.
        if (d.name) { setProfileName(d.name); cloudNameShow(); }
        if (cloudSess) { cloudSess.pub = !!d.pub; cloudSaveSess(); }
        if (el("cloud-pub")) el("cloud-pub").checked = !!d.pub;
        if (d.count != null) cloudMsg("Profile has " + d.count + " scene" + (d.count === 1 ? "" : "s") + " stored.");
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

  // ---- publish ----
  // Toggling this re-saves the WHOLE profile rather than patching `pub` alone, and that is
  // forced by the rules, not laziness: they require the resulting document to carry
  // name/payload/count/pub, so a pub-only write to a profile that does not exist yet fails
  // validation. Going through cloudSave() always produces a document the rules accept.
  function cloudPublish(on) {
    if (!cloudSess) return;
    cloudSess.pub = !!on;
    cloudSaveSess();
    track("cloud_publish", { on: !!on });
    cloudSave();
    galBust();                          // this profile just entered or left the listing
  }

  // ---- gallery ----
  // Public profiles, readable WITHOUT signing in: the rules allow a `pub == true` query from
  // an unauthenticated caller (and deny an unfiltered one), so any visitor can browse.
  const GAL_KEY = "burnTheWeb.gallery.v1";
  const galUrl = "https://firestore.googleapis.com/v1/projects/" + (CLOUD.projectId || "")
    + "/databases/(default)/documents";
  // Plain fetch with the api key, NOT cloudFetch: these documents are public, and gallery
  // browsing must work for a signed-out visitor who has no token to attach.
  function galFetchJson(url, opts) {
    return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(CLOUD.apiKey), opts);
  }
  // `select` projects away the payload. Without it every listed profile drags its whole
  // compressed library down the wire — 20 profiles would be megabytes to render a list of
  // names. (It does not reduce the read quota, which is per document either way.)
  function galQuery(ordered) {
    const q = {
      structuredQuery: {
        from: [{ collectionId: "profiles" }],
        where: { fieldFilter: { field: { fieldPath: "pub" }, op: "EQUAL", value: { booleanValue: true } } },
        select: { fields: [{ fieldPath: "name" }, { fieldPath: "count" }, { fieldPath: "updated" }] },
        limit: CLOUD.galleryLimit || 20,
      },
    };
    if (ordered) q.structuredQuery.orderBy = [{ field: { fieldPath: "updated" }, direction: "DESCENDING" }];
    return galFetchJson(galUrl + ":runQuery", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q),
    });
  }
  // Ordered first, unordered as a fallback. `where pub == true` + `orderBy updated` needs a
  // COMPOSITE INDEX, which a fresh project does not have — Firestore answers 400
  // FAILED_PRECONDITION with a one-click creation URL. Rather than making the gallery dead
  // until someone visits that URL, fall back to the unordered query (no index required) and
  // sort client-side; the index simply makes it correct beyond the page limit later.
  let galIndexWarned = false;
  function galList() {
    return galQuery(true).then(r => {
      if (r.ok) return r.json().then(j => ({ rows: j, ordered: true }));
      return r.text().then(t => {
        if (/FAILED_PRECONDITION|requires an index/i.test(t)) {
          if (!galIndexWarned) {
            galIndexWarned = true;
            const m = /https:\/\/console\.firebase\.google\.com\S*/.exec(t);
            console.info("[burnTheWeb] gallery is unsorted until this index exists:", m ? m[0].replace(/["\\].*$/, "") : "(see Firestore console)");
          }
          return galQuery(false).then(r2 => (r2.ok ? r2.json().then(j => ({ rows: j, ordered: false }))
            : r2.text().then(t2 => Promise.reject(new Error(cloudErr(t2, r2.status))))));
        }
        return Promise.reject(new Error(cloudErr(t, r.status)));
      });
    }).then(res => {
      const items = (res.rows || []).filter(x => x.document).map(x => {
        const d = fsIn(x.document);
        return { uid: String(x.document.name).split("/").pop(), name: d.name || "Untitled",
                 count: d.count || 0, updated: d.updated || "" };
      });
      // Sort ALWAYS, not only on the fallback. The two paths differ in what they SELECT —
      // an indexed query returns the genuinely newest `limit` documents, the unordered one
      // returns an arbitrary `limit` — but neither is a reason for the rendered order to
      // depend on which path ran. Sorting ≤20 items is free, and it means the list reads the
      // same before and after the composite index exists.
      items.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
      return items;
    });
  }
  // Cache the listing: 20 document reads per open against a 50k/day quota is fine on a
  // button and wasteful if every glance re-queries.
  function galCached() {
    try {
      const c = JSON.parse(localStorage.getItem(GAL_KEY) || "null");
      if (c && Date.now() - c.t < (CLOUD.galleryTtlMs || 300000)) return c.items;
    } catch (e) { /* fall through to a live fetch */ }
    return null;
  }
  function galStore(items) {
    try { localStorage.setItem(GAL_KEY, JSON.stringify({ t: Date.now(), items })); } catch (e) {}
  }
  function galBust() { try { localStorage.removeItem(GAL_KEY); } catch (e) {} }

  function galRender(items) {
    const host = el("gal-list");
    host.textContent = "";
    if (!items.length) {
      el("gal-hint").textContent = "No one has published any scenes yet. Tick “Publish to gallery” to be the first.";
      return;
    }
    el("gal-hint").textContent = "";
    items.forEach(p => {
      const row = document.createElement("div");
      row.className = "gal-row";
      const nm = document.createElement("div");
      nm.className = "gal-name";
      nm.textContent = p.name;
      const meta = document.createElement("div");
      meta.className = "gal-meta";
      meta.textContent = p.count + " scene" + (p.count === 1 ? "" : "s")
        + (p.updated ? " · " + String(p.updated).slice(0, 10) : "");
      // ONE button, because there is no longer a merge-vs-replace question to answer:
      // someone else's scenes are installed as their own collection under their name, so
      // they cannot overwrite yours and re-loading simply refreshes their set. That is also
      // what lets the whole row be one line — see the .gal-row grid.
      const btns = document.createElement("div");
      btns.className = "gal-btns";
      const b = document.createElement("button");
      b.type = "button"; b.className = "audbtn"; b.textContent = "Load scenes";
      b.title = "Add these as a “" + p.name + "” collection in your scene list — your own scenes are untouched";
      b.addEventListener("click", () => galLoad(p));
      btns.appendChild(b);
      row.appendChild(nm); row.appendChild(meta); row.appendChild(btns);
      host.appendChild(row);
    });
  }
  // One public profile, fetched and decoded into its blob. Split out of galLoad because
  // refollowCollections needs exactly the same three steps (fetch → payload → unzip → parse)
  // and a second copy is how the two would drift. Rejects with a readable message at each
  // step; every caller turns that into a line of UI rather than a console trace.
  function galFetchLibrary(uid) {
    return galFetchJson(galUrl + "/profiles/" + encodeURIComponent(uid)).then(r => {
      if (!r.ok) return r.text().then(t => Promise.reject(new Error(cloudErr(t, r.status))));
      return r.json();
    }).then(doc => {
      const d = fsIn(doc);
      if (!d.payload) throw new Error("that profile is empty");
      return unzipFromB64(d.payload);
    }).then(json => {
      if (json == null) throw new Error("could not read that profile");
      try { return JSON.parse(json); } catch (e) { throw new Error("that profile is corrupt"); }
    });
  }
  function galLoad(p) {
    el("gal-hint").textContent = "Fetching “" + p.name + "”…";
    galFetchLibrary(p.uid).then(raw => {
      galOpen(false);
      // Straight in, no Restore dialog: there is nothing left to ask, since the scenes go
      // into their own collection rather than over yours. Same validation and the same
      // write/reload underneath (applySharedLibrary drives applyRestore), so nothing about
      // the load path itself changes — only where the scenes land.
      // Record that you added them BEFORE the install: applySharedLibrary ends in applyRestore,
      // which snapshots, writes localStorage and reloads, so anything set afterwards is lost.
      noteCollection(p.name, p.uid);
      applySharedLibrary(raw, false, p.name);
      track("cloud_gallery_load", { collection: p.name });
    }).catch(e => { el("gal-hint").textContent = "Could not load: " + e.message; });
  }
  function galOpen(show, force) {
    const dlg = el("galdlg");
    if (!dlg) return;
    dlg.classList.toggle("hidden", !show);
    if (!show) return;
    const cached = force ? null : galCached();
    if (cached) { galRender(cached); return; }
    el("gal-list").textContent = "";
    el("gal-hint").textContent = "Loading…";
    galList().then(items => { galStore(items); galRender(items); })
      .catch(e => { el("gal-hint").textContent = "Could not load the gallery: " + e.message; });
  }

  // ---- share the running scene through Firestore -------------------------------------
  // Signed in, "Share this scene" stores the scene as one immutable document in /scenes and
  // hands back a ~30-character link. Signed out (or if the write fails for any reason) it
  // falls back to the self-contained ?z= link, so sharing never stops working and never
  // requires an account — the cloud route is an optimisation, not a gate.
  //
  // /scenes is deliberately NOT /profiles: a link pointing into a profile would only open
  // while that profile was published to the gallery, so sharing one scene would drag the
  // sharer's entire library public with it. These stay independent decisions.
  //
  // The payload is `sceneBlob()` — the exact blob the ?z= link carries, through the exact
  // same codec — so both transports describe a shared scene identically and the recipient
  // path is the one that already exists (installShared).
  function cloudShareScene() {
    const json = JSON.stringify(sceneBlob());
    const dir = location.origin + location.pathname.replace(/[^/]*$/, "");
    if (!cloudOn() || !cloudSess) return shareUrl();          // signed out ⇒ the classic link
    return zipToB64(json).then(payload => {
      if (payload == null || payload.length >= 200000) return shareUrl();
      const body = fsOut({
        owner: cloudSess.uid,
        payload,
        name: (presetSel && presetSel.selectedIndex >= 0 && curPreset >= 0 && presets[curPreset]
          ? String(presets[curPreset].name) : "Shared scene").slice(0, 60),
        created: new Date(),
      });
      // POST to the COLLECTION mints an auto-id; PATCH would need us to invent one and risk
      // colliding with (or overwriting) someone else's — and /scenes forbids update anyway.
      return cloudFetch(galUrl + "/scenes", { method: "POST", body: JSON.stringify(body) })
        .then(r => (r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(cloudErr(t, r.status))))))
        .then(doc => {
          const id = String(doc.name || "").split("/").pop();
          if (!id) throw new Error("no document id returned");
          track("share_scene_cloud", {});
          return dir + "#c=" + id;
        })
        .catch(() => shareUrl());       // quota, rules, offline — the link still works
    });
  }
  // Recipient side of #c=<id>. Called (deferred) from applyShared: the fetch is anonymous,
  // because a share link must open for someone with no account.
  //
  // Returns {json, name}, not the bare payload: the document carries the sender's own name for
  // the scene, and a shared scene is now KEPT as a real scene in the recipient's library, so it
  // needs something to be called. ?z=/?s= have no equivalent — sceneBlob() has no name field —
  // so this is the only path that can supply one.
  function cloudFetchScene(id) {
    if (!CLOUD.apiKey || !CLOUD.projectId) return Promise.resolve(null);
    return galFetchJson(galUrl + "/scenes/" + encodeURIComponent(id))
      .then(r => (r.ok ? r.json() : null))
      .then(doc => {
        if (!doc) return null;
        const d = fsIn(doc);
        if (!d.payload) return null;
        return unzipFromB64(d.payload).then(json => (json ? { json, name: d.name || "" } : null));
      })
      .catch(() => null);
  }

  // ---- profile name: text, not a permanently open input ----
  // Signed in, the name is a label you click to edit. `#cloud-name` remains the VALUE STORE
  // (cloudSave and cloudFetchProfileMeta both read/write it, unchanged) — this only governs
  // which of the two is on screen, the same arrangement `#palette` has behind the swatches.
  const NAME_EMPTY = "Set a profile name…";
  function cloudNameShow() {
    const view = el("cloud-nameview"), inp = el("cloud-name");
    if (!view || !inp) return;
    const v = (inp.value || "").trim();
    view.textContent = v || NAME_EMPTY;
    view.classList.toggle("empty", !v);
    view.style.display = "";
    inp.style.display = "none";
  }
  function cloudNameEdit() {
    const view = el("cloud-nameview"), inp = el("cloud-name");
    if (!view || !inp) return;
    view.style.display = "none";
    inp.style.display = "";
    inp.focus();
    inp.select();
  }
  function cloudNameCommit() {
    const inp = el("cloud-name");
    setProfileName(inp ? inp.value : "");   // trims, caches, and relabels the scene list
    cloudNameShow();
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
    // Signed in, the sign-in box is hidden AND EMPTIED. Hiding alone left an empty bordered
    // box on screen for at least one real user — Google's button is an iframe in markup that
    // is theirs, not ours, so what survives a `display:none` on the container is not something
    // to reason about from here. Removing the children removes the question, and also stops a
    // third-party iframe sitting in the page for a signed-in session that has no use for it.
    // The `.signed-in` class is what actually hides it, so no inline style (ours or Google's)
    // can win; gsiWidth resets so sign-out re-renders it at the right width.
    const row = el("cloudrow");
    if (row) row.classList.toggle("signed-in", inS);
    if (signin) {
      signin.style.display = inS ? "none" : "";
      if (inS && signin.children.length) { signin.textContent = ""; gsiWidth = 0; }
      // Signed out, draw the button back straight away. Leaving this to the ResizeObserver
      // looked equivalent and was not: it left an empty bordered box after sign-out — the
      // mirror image of the bug being fixed. gsiRender self-guards on GIS being loaded and on
      // the box having a width, so calling it here is safe even during startup.
      if (!inS) gsiRender();
    }
    // Its own line now, not a suffix to a "Cloud profile" label — the box title says that.
    // So it has to state both halves rather than only marking the signed-in one.
    if (who) who.textContent = inS
      ? "Signed in — your scenes can be saved here and picked up on another machine."
      : "Sign in to keep your scenes online and pick them up on another machine.";
    const pubBox = el("cloud-pub");
    if (pubBox) pubBox.checked = !!(cloudSess && cloudSess.pub);
    cloudNameShow();                     // signing in/out always lands back on the label
    if (!inS) cloudMsg("");
  }

  // Render (or re-render) Google's button at the width its box actually has.
  //
  // Google draws this button itself and its internals cannot be styled — the theme/shape/size
  // options are the whole supported surface — so the ONLY way to stop it overflowing the
  // 250px panel is to tell it the width. And that width can only be measured while the panel
  // is open: closed, clientWidth is 0, which is why this re-runs from a ResizeObserver rather
  // than once at startup. Google clamps `width` to 200–400, so the container's padding is kept
  // small enough that its content box stays above 200 inside a 250px panel.
  let gsiWidth = 0;
  function gsiRender() {
    const host = el("cloud-signin");
    if (!host || !window.google || !window.google.accounts || !window.google.accounts.id) return;
    const avail = Math.round(host.clientWidth);
    if (avail <= 0) return;                     // panel closed — wait for the observer
    const w = Math.max(200, Math.min(400, avail));
    if (w === gsiWidth) return;                 // already drawn at this width
    gsiWidth = w;
    host.textContent = "";                      // renderButton appends; clear the old one first
    try {
      window.google.accounts.id.renderButton(host, {
        theme: "filled_black", shape: "pill", size: "large",
        text: "signin_with", logo_alignment: "left", width: w,
      });
    } catch (e) { /* GIS unavailable — the message line already says so */ }
  }

  // Google Identity Services renders the sign-in button and hands back a Google ID token,
  // which cloudSignIn trades for a Firebase session. Loaded lazily and ONLY when configured,
  // so an unconfigured build makes no third-party request at all.
  function cloudInit() {
    if (!cloudOn()) return;              // feature off ⇒ the row stays hidden, nothing loads
    const row = el("cloudrow");
    if (row) row.classList.remove("hidden");
    cloudLoadSess();
    // Seed the field from the cached name BEFORE any request, so the box shows who you are
    // straight away and the scene list's heading (already reading the same cache) agrees.
    const cached = storedProfileName();
    if (cached && el("cloud-name") && !el("cloud-name").value) el("cloud-name").value = cached;
    cloudNameShow();
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
        // Google renders this button itself, under its branding rules — its internals cannot
        // be restyled (it is their markup, and the shape/colour options are the supported
        // surface). So: pick the variant that sits closest to this panel — black fill, pill,
        // to match the rounded amber buttons — and size it to the panel width so it does not
        // read as a foreign object dropped in. The surrounding padding/centreing is CSS on
        // #cloud-signin, which IS ours.
        gsiRender();
        // The width can only be measured while the panel is OPEN — closed, clientWidth is 0
        // and any guess bakes in the wrong number. So render (or re-render) whenever the box
        // actually has a width: on open, and on any panel/window resize.
        if (window.ResizeObserver) new ResizeObserver(gsiRender).observe(el("cloud-signin"));
      } catch (e) { cloudMsg("Sign-in unavailable: " + e.message, true); }
    };
    s.onerror = () => cloudMsg("Could not reach Google sign-in.", true);
    document.head.appendChild(s);
  }

  if (el("cloud-save")) el("cloud-save").addEventListener("click", cloudSave);
  if (el("cloud-load")) el("cloud-load").addEventListener("click", cloudLoad);
  if (el("cloud-delete")) el("cloud-delete").addEventListener("click", cloudDelete);
  if (el("cloud-signout")) el("cloud-signout").addEventListener("click", cloudSignOut);
  if (el("cloud-pub")) el("cloud-pub").addEventListener("change", e => cloudPublish(e.target.checked));
  if (el("cloud-nameview")) {
    el("cloud-nameview").addEventListener("click", cloudNameEdit);
    // Keyboard parity: the label is focusable, so Enter/Space must open it too.
    el("cloud-nameview").addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cloudNameEdit(); }
    });
  }
  if (el("cloud-name")) {
    el("cloud-name").addEventListener("blur", cloudNameCommit);
    el("cloud-name").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); cloudNameCommit(); }
      else if (e.key === "Escape") { e.preventDefault(); cloudNameCommit(); }
    });
  }
  // No #cloud-browse listener: the gallery is opened from the ☰ root item "Public scenes",
  // which calls galOpen(true) directly (see ui-menubar.js).
  if (el("gal-close")) el("gal-close").addEventListener("click", () => galOpen(false));
  if (el("gal-refresh")) el("gal-refresh").addEventListener("click", () => galOpen(true, true));
  if (el("galdlg")) el("galdlg").addEventListener("click", e => { if (e.target === el("galdlg")) galOpen(false); });
  cloudInit();
