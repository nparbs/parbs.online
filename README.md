# parbs.online

Source for [parbs.online](https://parbs.online), a landing page for my games, projects, content and GitHub repos.

It's a static site with no build step. Everything published is in `site/`.

## Run it locally

```sh
python -m http.server 8000 --directory site
```

Then open <http://localhost:8000>.

## Updating it

- **Games, projects and content:** edit `site/index.html`. Images and videos go in `site/assets/`.
- **GitHub section:** public repos appear automatically. To hide one, or to stop listing a repo once it's featured, add it to `EXCLUDED` in `scripts/fetch-repos.mjs`.

## Deployment

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`. The workflow also runs daily to refresh `repos.json`. GitHub pauses scheduled workflows after 60 days without repo activity, and re-enabling it in the Actions tab resumes them.

DNS is on Cloudflare:

| Type | Name | Target |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `nparbs.github.io` |
