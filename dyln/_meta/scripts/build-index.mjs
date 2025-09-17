// scripts/build-index.mjs
import { promises as fs } from 'fs';
import path from 'path';

const BRAND_DIR = 'backlinks/dyln';
const PROVIDERS = JSON.parse(await fs.readFile(path.join(BRAND_DIR, '_meta/providers.json'), 'utf8'));

// helper to slugify leaf folder into a readable title (optional)
const titleFromSlug = s => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase());

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async (e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return p;
  }))).flat();
};

const files = await walk(BRAND_DIR);

// Find index.html files in provider/tier/slug/index.html
const posts = [];
for (const file of files) {
  if (!file.endsWith('index.html')) continue;
  const parts = file.split(path.sep);

  // backlinks/dyln/<provider>/<tier>/<slug>/index.html
  const [_, __, provider, tier, slug] = parts.slice(-6, -1); // slice from end for robustness
  if (!provider || !tier || !slug) continue;

  // Build predictable project 'name' for providers that use subdomain name
  const name = `dyln-${tier}-${slug}-${provider.replace('cloudflare','cf')}`;

  // Compose final URL using providers.json
  const template = PROVIDERS[provider] || '';
  const url = template
    .replace('{name}', name)
    .replace('{tier}', tier)
    .replace('{slug}', slug);

  posts.push({
    provider, tier, slug, name,
    title: titleFromSlug(slug),
    url
  });
}

// Persist machine-readable manifest
await fs.writeFile(path.join(BRAND_DIR, 'posts.json'), JSON.stringify(posts, null, 2));

// Write human index
const body = posts
  .sort((a,b) => a.tier.localeCompare(b.tier) || a.provider.localeCompare(b.provider) || a.slug.localeCompare(b.slug))
  .map(p => `
    <a class="card" href="${p.url}" target="_blank" rel="noopener">
      <div class="pill">${p.tier.toUpperCase()}</div>
      <h3>${p.title}</h3>
      <div class="meta">${p.provider} • ${p.slug}</div>
    </a>`).join('\n');

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DYLN Backlinks – All Providers</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#0b0c10;color:#e8f0ff}
header{padding:24px 20px;border-bottom:1px solid #1e232b}
h1{margin:0;font-size:22px}
.grid{display:grid;gap:14px;padding:20px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{display:block;padding:14px 14px 12px;border:1px solid #1e232b;border-radius:10px;text-decoration:none;color:inherit;background:linear-gradient(180deg,#0b0c10,#0f1117)}
.card:hover{border-color:#3be0ff;box-shadow:0 8px 24px rgba(59,224,255,.12)}
h3{margin:10px 0 6px;font-size:16px}
.meta{opacity:.7;font-size:12px}
.pill{display:inline-block;font-size:11px;padding:2px 8px;border:1px solid #3be0ff;color:#3be0ff;border-radius:999px}
</style>
<header><h1>DYLN – Backlinks Overview</h1></header>
<main class="grid">
${body}
</main>`;
await fs.writeFile(path.join(BRAND_DIR, 'index.html'), html);

console.log(`Built ${posts.length} links → backlinks/dyln/index.html`);
