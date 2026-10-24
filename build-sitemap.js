
const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://codezen-exs.pages.dev';
const KEY = '28130b9eccde4611b9fe2363899bec2b';

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const URLS_FILE = path.join(ROOT, 'urls.txt');
const ROOT_REDIRECTS = path.join(ROOT, '_redirects');

const PUBLIC_REDIRECTS = path.join(PUBLIC_DIR, '_redirects');
const PUBLIC_KEY_FILE = path.join(PUBLIC_DIR, `${KEY}.txt`);
const SITEMAP_FILE = path.join(PUBLIC_DIR, 'sitemap.xml');

if (!fs.existsSync(URLS_FILE)) {
  throw new Error('urls.txt is missing. Deployment stopped.');
}

if (!fs.existsSync(ROOT_REDIRECTS)) {
  throw new Error('Root _redirects file is missing. Deployment stopped.');
}

// Preserve the original redirect file exactly.
const originalRedirects = fs.readFileSync(ROOT_REDIRECTS, 'utf8');

const redirectRules = originalRedirects
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.trim().startsWith('#'));

if (redirectRules.length > 2000) {
  throw new Error(
    `Redirect validation failed: ${redirectRules.length} rules found.`
  );
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

  // Standardize URLs to HTTPS.
  url.protocol = 'https:';

  // Normalize duplicate slashes in the pathname.
  url.pathname = '/' + url.pathname.split('/').filter(Boolean).join('/');

  urls.add(url.href);
}

if (urls.size === 0) {
  throw new Error('No valid URLs found. Deployment stopped.');
}

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Copy original redirects to the actual deployment directory.
fs.writeFileSync(PUBLIC_REDIRECTS, originalRedirects, 'utf8');

// Generate the IndexNow verification file in the deployment directory.
// IMPORTANT: KEY must match the key used by ping-indexnow.js.
fs.writeFileSync(PUBLIC_KEY_FILE, KEY, 'utf8');

// Generate sitemap with hourly lastmod and changefreq.
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

fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');

// Validate all generated deployment files.
if (
  fs.readFileSync(PUBLIC_REDIRECTS, 'utf8') !== originalRedirects
) {
  throw new Error('Redirect file verification failed.');
}

if (fs.readFileSync(PUBLIC_KEY_FILE, 'utf8').trim() !== KEY) {
  throw new Error('IndexNow key file verification failed.');
}

if (!fs.readFileSync(SITEMAP_FILE, 'utf8').includes('<changefreq>hourly</changefreq>')) {
  throw new Error('Hourly sitemap frequency is missing.');
}

console.log(`Sitemap URLs generated: ${urls.size}`);
console.log(`lastmod: ${lastmod}`);
console.log('changefreq: hourly');
console.log(`Redirect rules preserved: ${redirectRules.length}`);
console.log('IndexNow verification file generated.');
console.log('Build validation passed.');
