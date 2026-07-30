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

## [1.3.0] — 2026-07-30

### Added

- **Share this scene** — a new button beside *Share presets…* that copies a link to whatever
  is running right now. Signed in, the scene is stored in the cloud and the link is a dozen
  characters instead of a few thousand; signed out it falls back to the self-contained link
  that carries the scene itself, so sharing never needs an account and never stops working.
  Opening one runs the scene straight away as an unsaved scene — none of your own presets are
  touched. The link is a snapshot: editing the scene afterwards does not change what someone
  else sees until you share it again.

### Changed

- **The layer drag handle now selects its layer too**, on release — so grabbing a layer to
  reorder it also brings it up for editing. Dragging still reorders exactly as before, and the
  dragged layer ends up selected wherever it lands.
- **The beat-detection trace moved into the Beat tuning box**, next to the thresholds it
  exists to help you set, instead of sitting in a separate Diagnostics section.
- **The frame + FPS counter has no toggle any more** — **H** (hide all chrome) already
  governs it, and two controls for one thing only ever disagree. With both of its toggles
  rehoused, the Diagnostics section is gone.
- The Google sign-in button is sized to fit the menu and given room to breathe. Its internals
  are Google's own and cannot be restyled, so this is as close to the panel as it gets.
- **The page is now titled "burnTheWeb — a fractal bonfire that dances to your music"** — the
  tab, the search result and the link preview all say what it does to you rather than which
  genre it belongs to. The description was also three effects out of date (it still claimed
  fifteen; there are twenty, including the 3D solids).

### Fixed

- Opening a shared link left the preset chooser naming one of **your** presets, so an arriving
  scene looked like it had loaded that preset. It now reads "— unsaved scene —", which is what
  it always actually was. Affected every shared scene link, not just the new ones.

### Internal

- `firestore.rules` gains a `/scenes` collection for shared scenes: fetchable by id without an
  account (a share link must open for anyone) but **not listable**, so links stay unlisted
  rather than becoming a public directory of everything anyone has ever shared. Owner-stamped,
  immutable, and deletable by its owner. Kept separate from `/profiles` on purpose — a link
  into a profile would only open while that profile was published, so sharing one scene would
  have forced the sharer's whole library public.
- A `firebase.json` so the rules can be deployed from the repo (`firebase deploy --only
  firestore:rules`) instead of pasted into a console — it adds no dependency and no build step.
- Dev controls opt out of preset autosave with `data-nopersist` rather than by living in a
  particular section, which is what let the beat trace move into a box that deliberately does
  autosave everything else in it.

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
