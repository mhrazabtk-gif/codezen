
const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://codezen-exs.pages.dev';
const KEY = '28130b9eccde4611b9fe2363899bec2b';

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const URLS_FILE = path.join(ROOT, 'urls.txt');
const ROOT_REDIRECTS = path.join(ROOT, '_redirects');
const PUBLIC_REDIRECTS = path.join(PUBLIC_DIR, '_redirects');
const ROOT_KEY = path.join(ROOT, `${KEY}.txt`);
const PUBLIC_KEY = path.join(PUBLIC_DIR, `${KEY}.txt`);
const SITEMAP_FILE = path.join(PUBLIC_DIR, 'sitemap.xml');

if (!fs.existsSync(URLS_FILE)) {
  throw new Error('urls.txt is missing. Deployment stopped.');
}

if (!fs.existsSync(ROOT_REDIRECTS)) {
  throw new Error('Root _redirects is missing. Deployment stopped.');
}

if (!fs.existsSync(ROOT_KEY)) {
  throw new Error('Existing IndexNow key file is missing.');
}

if (fs.readFileSync(ROOT_KEY, 'utf8').trim() !== KEY) {
  throw new Error('IndexNow key does not match the existing key file.');
}

const redirectContent = fs.readFileSync(ROOT_REDIRECTS, 'utf8');

const redirectRules = redirectContent
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.trim().startsWith('#'));

if (redirectRules.length > 2000) {
  throw new Error(`Redirect limit check failed: ${redirectRules.length} rules.`);
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

  // Standardize URLs to HTTPS and remove duplicate path slashes.
  url.protocol = 'https:';
  url.pathname = '/' + url.pathname.split('/').filter(Boolean).join('/');

  urls.add(url.href);
}

if (urls.size === 0) {
  throw new Error('No valid URLs found. Deployment stopped.');
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const lastmod = new Date().toISOString();

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

// Preserve the original redirect rules exactly.
fs.copyFileSync(ROOT_REDIRECTS, PUBLIC_REDIRECTS);

// Copy the existing, verified IndexNow key into the deployment folder.
fs.copyFileSync(ROOT_KEY, PUBLIC_KEY);

// Generate only the sitemap; do not overwrite other public assets.
fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');

// Validate the final deployment files.
if (fs.readFileSync(PUBLIC_REDIRECTS, 'utf8') !== redirectContent) {
  throw new Error('Redirect file verification failed.');
}

if (fs.readFileSync(PUBLIC_KEY, 'utf8').trim() !== KEY) {
  throw new Error('Public IndexNow key verification failed.');
}

if (
  !xml.includes('<lastmod>') ||
  !xml.includes('<changefreq>hourly</changefreq>')
) {
  throw new Error('Required sitemap tags are missing.');
}

console.log(`Sitemap generated with ${urls.size} URLs.`);
console.log(`lastmod: ${lastmod}`);
console.log('changefreq: hourly');
console.log(`Redirect rules preserved: ${redirectRules.length}`);
console.log('All validation checks passed.');
