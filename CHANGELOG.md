# Changelog

All notable changes to [burnTheWeb](https://carlemil.github.io/burnTheWeb/), newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the version
numbers follow [Semantic Versioning](https://semver.org/):

- **patch** (1.1.**x**) — fixes and copy changes, nothing new to find in the menu.
- **minor** (1.**x**.0) — a new effect, filter, control or panel feature.
- **major** (**x**.0.0) — a change that stops an existing saved scene, share link or backup
  from loading exactly as it did. There has not been one, and the intent is that there never
  is: every link ever generated still decodes.

The version shown at the foot of the menu is `CONFIG.version` in `src/config.js`, which is
the single source of truth; `/deploy` bumps it and adds the section below in the same commit.

## [1.2.0] — 2026-07-30

### Added

- **Cloud profiles.** Sign in with Google and keep your preset library online, so it follows
  you between machines instead of living in one browser. In *Backup, restore & share*:
  **Save to cloud** uploads your presets, **Load from cloud** fetches them back and opens the
  usual restore dialog so you choose merge or replace, and **Delete profile** removes
  everything you have stored. Stored against your account: the profile name you type and your
  presets — not your email, name or picture. Your profile name reads as plain text once you
  are signed in; click it to rename.
- **A public gallery.** Tick **Publish to gallery** to list your profile, and
  **Browse profiles…** to see everyone who has. Loading someone's profile goes through the
  same merge-or-replace dialog, so nothing of yours is overwritten without asking. Browsing
  needs no account — anyone can look. Publishing is opt-in and off by default.

### Changed

- **Pressing anywhere in a layer row selects that layer** — the mute dot, the gain slider,
  the blend dropdown, the effect chooser, all of it. Previously those controls acted on their
  layer while the sliders below kept editing a different one. Dragging the grab handle still
  reorders without selecting.
- The divider above the first slider group in *Effect & Filters* is gone. It sat directly
  under the box title, where it read as a stray rule rather than a separator.

### Internal

- `firestore.rules` is checked in: with no backend, it is the entire authorization boundary,
  so it belongs in review rather than only in a web console. Verified against the live
  database that an unauthenticated read of a private profile, an unauthenticated write, and
  an unfiltered listing are all denied, while the gallery's `pub == true` query is allowed.
- The Firebase web API key sits in the source deliberately — it is a public project
  identifier, not a credential (GitHub secret-scanning alert #1, resolved on that basis).
- New `tools/cloudprobe.js`, plus headless suites covering the gallery, the configured
  save/load path with `fetch` stubbed, and the assertion that an unconfigured build makes no
  network request at all.

## [1.1.0] — 2026-07-30

### Added

- **Bouncing solids** — a new, genuinely 3D effect, and the first raymarched one. Solid
  spheres, boxes, doughnuts, capsules, octahedra and cylinders tumble and ricochet inside an
  invisible room, drawn as signed-distance fields and shaded into the palette by surface
  angle and depth. Six sliders: **Count**, **Size** (also the radius they bounce on, so
  bigger bodies turn sooner), **Shape mix** (1 = all spheres … 6 = one of each), **Speed**,
  **Tumble**, and **Edge glow** for the silhouettes. A wall impact converts sideways travel
  into roll, so an angled clip visibly kicks a body into a tumble. Tick Fire or Fade pixel
  for trails; it stacks and blends like any other layer, with its own palette and filters.
- **An effect chooser on every layer row.** Re-pointing a layer no longer means selecting it
  and then scrolling down to the chooser — each row in the *Layers* box carries its own
  dropdown. Picking on a row that is not selected selects it first, so a layer keeps its
  palette and filters exactly as it does when you switch it the long way round.
- **A palette editor.** Hover any palette swatch and click **+** to make an editable copy of
  it (or **✎** on one of your own to edit it in place — the nineteen built-in ramps are never
  changed). The ramp is edited as colour stops on a gradient bar: click the bar to add a stop
  there, drag a handle to move it, pick colours with the colour box. **Every edit previews
  live on the scene**, so there is nothing to apply and nothing to guess at. Your palettes
  join the swatch list and the palette-cycle rotation, and are saved with your settings and
  backups. A copy you open and close without changing anything is discarded, so looking costs
  nothing; **Save & close** keeps it if you wanted the duplicate. **Delete palette** removes
  one of yours, and any layer using it falls back to the ramp it was copied from.
- **Version and release-notes link** at the foot of the menu (this file).

### Changed

- The *Effects & Filters* box is now **Effect & Filters** — singular, because everything in
  it edits the one layer you have selected; the plural read as "all of the effects".
- That box no longer carries its own **Effect** dropdown. Every layer row has one now, so the
  copy at the top of the box was a second visible control for the same thing; the sliders it
  used to sit above start the box instead.
- The palette inspector button is an **eye** instead of the old ▦ grid glyph, which
  described the dialog's layout rather than what the button does and read as a stop icon.
- Custom palettes ride in saved settings, backups and preset bundles. A scene that names a
  palette you do not have falls back to a built-in rather than failing to load — the same as
  any other out-of-range value.

### Fixed

- The comment describing the analytics hook still said it was inert "until
  `GA_MEASUREMENT_ID` is set"; it has held a real id for some time.

### Internal

- New `tools/solidsprobe.js` (39 assertions) covering the rigid-body physics: containment
  over 6000 steps and at every slider extreme, the clamped frame step (an unclamped
  backgrounded-tab `dt` tunnels a body through a wall), quaternion normality, per-layer body
  ownership, and the start-position spread. Every one of those failures is invisible to a
  screenshot, which is why they are assertions rather than a look at the picture.

## [1.0.0] — 2026-07-28

The first versioned release: everything the app was before release notes existed. Recent
work included in it, newest first —

- Per-layer **Heat boost** slider (palette brightness curve).
- `fire-physics.js` renamed to `tetrahedron-physics.js` and de-fired throughout.
- The scene **Share** and **Short link** buttons were removed; sharing is preset-bundle
  only now. Every `?z=` / `?s=` scene link ever generated still opens.
- **Share presets…** — bundle a curated set of presets into one link, carrying auto-cycle
  and the selected preset so the recipient opens on the same scene and the same show plays.
  The payload rides in the URL *fragment*, which is what keeps a multi-KB bundle from being
  rejected as "URI Too Long" before any JS runs.
- **Preset TTL** and **Transition** became per-preset, so a shared scene plays at the pace
  it was authored with.
- The **Orbit editor** and **Palette inspector** became translucent floating panels and hide
  with `M` / `H` along with the rest of the chrome.
- Fixed: stacked Tetrahedron layers shared one body list and moved in lockstep.
- Fixed: freehand orbit strokes were offset from the pointer.
- **Palette inspector** popup; a confirmation on *Reset this effect*.
- Tetrahedron gained controllable **Sway**, and orbits the centre when *Show box* is off.
- **Points** became a ranged slider, so it takes L/M/H beat triggers like the rest.
- Neutral effect defaults, and every filter off by default — a fresh effect renders its raw
  output and you tick what you want.
