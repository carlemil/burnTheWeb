---
name: deploy
description: Deploy burnTheWeb — build dev-index.html from src/, copy it to index.html (the live production page), commit both, and push. Invoke as /deploy. Use whenever the user wants to publish/deploy the current build to the live site.
---

# Deploy burnTheWeb

Promote the current `src/` build to the live production page. `index.html` is the
page GitHub Pages serves at `https://carlemil.github.io/burnTheWeb/`; `dev-index.html`
is the build's output file (also served at `…/dev-index.html` as a preview). Deploying
copies the fresh build over `index.html`. **There are no git hooks** — this skill is the
only thing that publishes.

Run these steps from the repo root:

1. **Build** the artifact from source:
   `node tools/build.js` — regenerates `dev-index.html` from `src/`.
2. **Promote** it to the production page:
   `cp dev-index.html index.html`
3. **Stage** both:
   `git add dev-index.html index.html`
4. **Nothing to deploy?** If `git diff --cached --quiet` reports no staged change,
   `index.html` already matches `src/` — tell the user "already up to date, nothing to
   deploy" and stop.
5. **Commit** with the project's standard trailer (from CLAUDE.md — the
   `Co-Authored-By:` line plus the `Claude-Session:` line), e.g. subject
   `Deploy: promote dev-index.html → index.html`.
6. **Push**: `git push origin HEAD:main` (rebase on origin/main first if the push is
   rejected as non-fast-forward). No hook fires; this is a single, normal push.
7. **Verify** (optional but preferred): poll `https://carlemil.github.io/burnTheWeb/`
   until it returns HTTP 200 with the expected size (~1 min for Pages to redeploy;
   hard-refresh bypasses cache), then tell the user it's live.

Notes:
- Never hand-edit `index.html` or `dev-index.html` — both are generated. Edit `src/*.js`
  / `src/styles.css`, then deploy.
- The normal (non-deploy) workflow commits `src/` + `dev-index.html` so the
  `/dev-index.html` preview tracks development; `/deploy` is what moves it to the
  production `index.html`.
