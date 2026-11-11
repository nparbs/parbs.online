const list = document.getElementById('repos');

function repoCard(repo) {
  const item = document.createElement('li');
  item.className = 'repo';

  const link = document.createElement('a');
  link.href = repo.url;

  const name = document.createElement('strong');
  name.textContent = repo.name;
  link.append(name);

  if (repo.description) {
    const description = document.createElement('p');
    description.textContent = repo.description;
    link.append(description);
  }

  const meta = document.createElement('small');
  const year = new Date(repo.pushedAt).getFullYear();
  meta.textContent = [repo.language, year].filter(Boolean).join(' · ');
  link.append(meta);

  item.append(link);
  return item;
}

// If the list can't load, the "All repositories" link below it still works.
fetch('repos.json')
  .then((res) => (res.ok ? res.json() : []))
  .then((repos) => list.append(...repos.map(repoCard)))
  .catch(() => {});

// Cards below the fold fade up as they scroll into view.
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.replace('reveal-wait', 'reveal-in');
      seen.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });

  for (const card of document.querySelectorAll('.game, .project')) {
    if (card.getBoundingClientRect().top < innerHeight) continue;
    card.classList.add('reveal-wait');
    seen.observe(card);
  }
}
