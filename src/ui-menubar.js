  // ---- ☰ fold-out menubar ------------------------------------------------------------
  // A traditional multi-level menu: the ☰ opens a root list, items with a ▸ open a submenu
  // beside it, and those can nest again (Audio ▸ Capture). It holds what used to be
  // the panel's Audio, Resolution, Cloud profile and Credits boxes, plus the Controls panel toggle —
  // the ☰ no longer toggles the panel itself, so this is where that lives (the "m" key still
  // does it directly, which is the fast route).
  //
  // THE LEAF PANELS ADOPT THE EXISTING NODES rather than rebuilding them. `#audiobox`,
  // `#resbox`, `#cloudbox` and `#creditbox` are authored in the panel markup and moved in here,
  // which is the same trick buildFilterUI uses to pull `#ctl-<key>` into a filter body. That
  // is not laziness — it is what keeps every listener, every `el(id)` lookup and every sync
  // path (setAudioUI, cloudSync, the Google sign-in button rendered into #cloud-signin)
  // working with no changes at all. Rebuilding this markup here would mean re-wiring the
  // whole cloud module.
  //
  // Runs LAST in the manifest: by the time it moves anything, every other slice has already
  // found its elements and attached its listeners. Moving a node never detaches a listener,
  // so the order only matters for code that looks nodes up at startup.

  const menubar = el("menubar");

  // One open path, from the root down: menuPath[0] is the root panel, [1] its open submenu,
  // and so on. Opening an item at depth d closes everything at depth > d, which is what
  // makes hovering across siblings behave like a real menu.
  let menuPath = [];

  function menubarOpen() { return !menubar.classList.contains("hidden"); }

  // Put every adopted block back where it came from before its panel is destroyed.
  // WITHOUT THIS, closing the menu deletes the real audio buttons, the resolution select,
  // #cloudrow and the credits list from the document — they are MOVED here, not copied, so
  // discarding the panel discards them and nothing that looks them up by id works again.
  // (Caught by the probe reopening the menu and finding an empty panel.)
  function returnAdopted(root) {
    for (const box of root.querySelectorAll(".mb-adopt")) {
      const home = el(box.dataset.adopt);
      if (!home) continue;
      while (box.firstChild) home.appendChild(box.firstChild);
      home.hidden = true;
    }
  }

  function menuCloseFrom(depth) {
    while (menuPath.length > depth) {
      const p = menuPath.pop();
      returnAdopted(p.el);
      p.el.remove();
      if (p.owner) p.owner.classList.remove("open");
    }
  }

  function menubarClose() {
    menuCloseFrom(0);
    menubar.classList.add("hidden");
    returnAdopted(menubar);        // belt and braces: nothing should be left, but if a panel
    menubar.textContent = "";      // ever escapes menuPath this stops it taking the DOM with it
    el("toggle").setAttribute("aria-expanded", "false");
  }

  // Build one panel of items and place it. `anchor` is the element it hangs off: the ☰ for
  // the root, the parent item for a submenu.
  function menuPanel(items, anchor, depth) {
    menuCloseFrom(depth);
    const p = document.createElement("div");
    p.className = "mb-panel";
    p.setAttribute("role", "menu");
    items.forEach(it => p.appendChild(menuItem(it, p, depth)));
    menubar.appendChild(p);

    // Position: the root drops below the ☰, a submenu opens to the right of its parent item.
    // Measured after insertion, then flipped/clamped so a deep submenu cannot run off screen.
    const a = anchor.getBoundingClientRect();
    const w = p.offsetWidth, h = p.offsetHeight;
    let left = depth === 0 ? a.left : a.right - 4;
    let top = depth === 0 ? a.bottom + 6 : a.top;
    if (left + w > innerWidth - 8) left = depth === 0 ? Math.max(8, innerWidth - w - 8) : Math.max(8, a.left - w + 4);
    if (top + h > innerHeight - 8) top = Math.max(8, innerHeight - h - 8);
    p.style.left = left + "px";
    p.style.top = top + "px";

    menuPath.push({ el: p, owner: depth === 0 ? null : anchor });
    return p;
  }

  // An item is one of:
  //   {label, sub: [...]}        — opens a submenu
  //   {label, run: fn}           — an action; closes the menu unless `keep` is set
  //   {label, check: () => bool, run: fn}  — a tick that stays open
  //   {adopt: "elementId"}       — moves that element's CHILDREN in as the panel body
  //   {sep: true}                — a rule
  function menuItem(it, panel, depth) {
    if (it.sep) {
      const s = document.createElement("div");
      s.className = "mb-sep";
      return s;
    }
    if (it.adopt) {
      // The adopted block is menu CONTENT, not a menu item: it keeps its own controls and
      // its own event handling, so clicks inside must not close the menu or open a sibling.
      const box = document.createElement("div");
      box.className = "mb-adopt";
      box.dataset.adopt = it.adopt;          // returnAdopted needs to know where home is
      const src = el(it.adopt);
      if (src) { src.hidden = false; while (src.firstChild) box.appendChild(src.firstChild); }
      box.addEventListener("click", e => e.stopPropagation());
      return box;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mb-item" + (it.sub ? " mb-sub" : "");
    b.setAttribute("role", "menuitem");
    if (it.title) b.title = it.title;
    const lab = document.createElement("span");
    lab.className = "mb-lab";
    lab.textContent = it.label;
    b.appendChild(lab);
    if (it.check) {
      const t = document.createElement("span");
      t.className = "mb-tick";
      t.textContent = it.check() ? "✓" : "";
      b.appendChild(t);
    }
    if (it.sub) {
      const c = document.createElement("span");
      c.className = "mb-chev";
      c.textContent = "▸";
      b.appendChild(c);
      // Open on hover as well as click — the hover is what makes it feel like a menubar,
      // and the click is what makes it work on a touchscreen.
      const open = () => {
        if (b.classList.contains("open")) return;
        [...panel.querySelectorAll(".mb-item.open")].forEach(o => o.classList.remove("open"));
        b.classList.add("open");
        menuPanel(typeof it.sub === "function" ? it.sub() : it.sub, b, depth + 1);
      };
      b.addEventListener("mouseenter", open);
      b.addEventListener("click", e => { e.stopPropagation(); open(); });
    } else {
      // A leaf closes everything deeper on hover, so moving from an open submenu onto a
      // plain sibling collapses it rather than leaving two panels open at once.
      b.addEventListener("mouseenter", () => {
        [...panel.querySelectorAll(".mb-item.open")].forEach(o => o.classList.remove("open"));
        menuCloseFrom(depth + 1);
      });
      b.addEventListener("click", e => {
        e.stopPropagation();
        if (it.run) it.run();
        if (it.check) { b.querySelector(".mb-tick").textContent = it.check() ? "✓" : ""; }
        else if (!it.keep) menubarClose();
      });
    }
    return b;
  }

  // The menu itself. `sub` may be a function so a submenu is built fresh each time it opens
  // — the cloud entries in particular depend on whether you are signed in right now.
  function menuModel() {
    return [
      { label: "Controls panel", title: "Show or hide the sliders (also the M key)",
        check: () => !panel.classList.contains("hidden"),
        run: () => setPanel(!panel.classList.contains("hidden")) },
      { label: "Fullscreen", title: "Toggle fullscreen (also the F key)",
        check: () => !!document.fullscreenElement, run: () => toggleFullscreen() },
      { label: "Hide all UI", title: "Strip every button and the menu for a clean capture (also the H key)",
        run: () => document.body.classList.add("ui-hidden") },
      { sep: true },
      // Audio and Resolution are ROOT items. They were under a "System" parent, which bought
      // one more hover to reach the two settings anyone actually opens this menu for, and
      // grouped them under a word that describes neither. Each still needs its own adopt host
      // (#audiobox, #resbox) — that never depended on the parent.
      { label: "Audio", sub: [{ adopt: "audiobox" }] },
      { label: "Resolution", sub: [{ adopt: "resbox" }] },
      { label: "Cloud profile", sub: [{ adopt: "cloudbox" }] },
      // A ROOT item, not a row inside Cloud profile: the gallery is readable signed out (the
      // rules allow an unauthenticated `pub == true` query), so filing it under a sign-in box
      // implied an account was needed. Gated on cloudOn() for the same reason #cloudrow is —
      // with no apiKey there is nothing to browse. Calls galOpen directly; the app is one
      // IIFE and this slice runs last, so the function is simply in scope.
      ...(cloudOn() ? [{ label: "Public scenes", title: "Browse the scenes other people have published, and load them",
        run: () => galOpen(true) }] : []),
      { label: "Credits", sub: [{ adopt: "creditbox" }] },
      { sep: true },
      { label: "What the controls do…", title: "Open the help panel", run: () => openHelp() },
    ];
  }

  function menubarToggle() {
    if (menubarOpen()) { menubarClose(); return; }
    menubar.classList.remove("hidden");
    menubar.textContent = "";
    menuPath = [];
    menuPanel(menuModel(), el("toggle"), 0);
    el("toggle").setAttribute("aria-expanded", "true");
  }

  // #menubar is a full-screen overlay that CATCHES clicks while open, so clicking away
  // closes the menu instead of falling through to the canvas and pausing the animation.
  // Panels stopPropagation, so a click on an item never reaches this.
  menubar.addEventListener("click", () => menubarClose());
  window.addEventListener("keydown", e => {
    if (e.key === "Escape" && menubarOpen()) menubarClose();
  });
