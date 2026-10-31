// Writes site/repos.json from the public GitHub API. Runs on every deploy and once a day.
import { writeFile } from 'node:fs/promises';

const USER = 'nparbs';
const OUTPUT = new URL('../site/repos.json', import.meta.url);

// Already featured higher up the page, or not worth a card (site repos, 2016 coursework).
const EXCLUDED = new Set([
  'parbs.online', 'nparbs.github.io', 'scrap-riot', 'tabplayer', 'QuickCut',
  'AdvjavaWK1', 'bookWebApp', 'Calculator', 'Class3Lab', 'DateTimePractice',
  'Encapsulation', 'ExceptionsLab', 'FilePractice', 'FirstGui', 'GenericsAndMaps',
  'GenericsAndSets', 'HelloApp', 'InterfaceAbstractLab', 'LabDIP', 'NJP.DiscountStrategy',
  'PHP-Final', 'Polymorphism',
]);

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'parbs.online' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const res = await fetch(`https://api.github.com/users/${USER}/repos?type=owner&sort=pushed&per_page=100`, { headers });
if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

const repos = (await res.json())
  .filter((r) => !r.private && !r.fork && !r.archived && !EXCLUDED.has(r.name))
  .map((r) => ({
    name: r.name,
    description: r.description,
    url: r.html_url,
    language: r.language,
    stars: r.stargazers_count,
    pushedAt: r.pushed_at,
  }));

await writeFile(OUTPUT, JSON.stringify(repos, null, 2) + '\n');
console.log(`Wrote ${repos.length} repos`);
