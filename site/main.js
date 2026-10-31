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
