const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://codezen-exs.pages.dev';
const KEY = '16d9ee2660ec4372bdeef3994bb6440d';

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const URLS_FILE = path.join(ROOT, 'urls.txt');
const REDIRECTS_FILE = path.join(PUBLIC_DIR, '_redirects');
const SITEMAP_FILE = path.join(PUBLIC_DIR, 'sitemap.xml');
const KEY_FILE = path.join(PUBLIC_DIR, `${KEY}.txt`);
const ROOT_KEY_FILE = path.join(ROOT, `${KEY}.txt`);

if (!fs.existsSync(URLS_FILE)) {
  throw new Error('urls.txt is missing. Deployment stopped.');
}

if (!fs.existsSync(REDIRECTS_FILE)) {
  throw new Error('public/_redirects is missing. Deployment stopped.');
}

const redirectRules = fs.readFileSync(REDIRECTS_FILE, 'utf8')
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.trim().startsWith('#'));

if (redirectRules.length > 2000) {
  throw new Error(`Redirect validation failed: ${redirectRules.length} rules.`);
}

const rawUrls = fs.readFileSync(URLS_FILE, 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

const urls = new Set();

for (const value of rawUrls) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid URL in urls.txt: ${value}`);
  }

  if (
    url.hostname.toLowerCase() !== 'codezen-exs.pages.dev' ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(`Unexpected URL in urls.txt: ${value}`);
  }

  url.protocol = 'https:';
  url.pathname = '/' + url.pathname.split('/').filter(Boolean).join('/');

  urls.add(url.href);
}

if (urls.size === 0) {
  throw new Error('No valid URLs found. Deployment stopped.');
}

const lastmod = new Date().toISOString();

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

for (const url of urls) {
  xml += '  <url>\n';
  xml += `    <loc>${escapeXml(url)}</loc>\n`;
  xml += `    <lastmod>${lastmod}</lastmod>\n`;
  xml += '    <changefreq>hourly</changefreq>\n';
  xml += '  </url>\n';
}

xml += '</urlset>\n';

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');

if (fs.existsSync(ROOT_KEY_FILE)) {
  const rootKey = fs.readFileSync(ROOT_KEY_FILE, 'utf8').trim();

  if (rootKey !== KEY) {
    throw new Error('Root IndexNow key file does not match the configured key.');
  }
} else {
  throw new Error('Existing root IndexNow key file is missing.');
}

fs.writeFileSync(KEY_FILE, KEY, 'utf8');

if (!fs.existsSync(REDIRECTS_FILE)) {
  throw new Error('_redirects is missing after sitemap generation.');
}

if (!fs.existsSync(SITEMAP_FILE) || !fs.existsSync(KEY_FILE)) {
  throw new Error('Sitemap or IndexNow key file is missing.');
}

console.log(`Sitemap URLs: ${urls.size}`);
console.log(`lastmod: ${lastmod}`);
console.log('changefreq: hourly');
console.log(`Redirect rules preserved: ${redirectRules.length}`);
console.log('Build validation passed.');
