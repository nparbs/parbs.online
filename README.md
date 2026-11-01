# parbs.online

Source for [parbs.online](https://parbs.online), a landing page for my games, projects and GitHub repos.

It's a static site with no build step. Everything published is in `site/`.

## Updating it

- **Games and projects:** edit `site/index.html`. Images and videos go in `site/assets/`.
- **GitHub section:** public repos appear automatically. To hide one, or to stop listing a repo once it's featured, add it to `EXCLUDED` in `scripts/fetch-repos.mjs`.

## Deployment

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`. The workflow also runs daily to refresh `repos.json`. GitHub pauses scheduled workflows after 60 days without repo activity, and re-enabling it in the Actions tab resumes them.
