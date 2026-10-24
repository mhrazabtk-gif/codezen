
const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://codezen-exs.pages.dev';
const KEY = '28130b9eccde4611b9fe2363899bec2b';

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const URLS_FILE = path.join(ROOT, 'urls.txt');

// Original files in the repository root
const ROOT_REDIRECTS = path.join(ROOT, '_redirects');
const ROOT_KEY_FILE = path.join(ROOT, `${KEY}.txt`);

// Files that Cloudflare Pages will deploy
const PUBLIC_REDIRECTS = path.join(PUBLIC_DIR, '_redirects');
const PUBLIC_KEY_FILE = path.join(PUBLIC_DIR, `${KEY}.txt`);
const SITEMAP_FILE = path.join(PUBLIC_DIR, 'sitemap.xml');

if (!fs.existsSync(URLS_FILE)) {
  throw new Error('urls.txt is missing. Deployment stopped.');
}

if (!fs.existsSync(ROOT_REDIRECTS)) {
  throw new Error('Original root _redirects file is missing. Deployment stopped.');
}

if (!fs.existsSync(ROOT_KEY_FILE)) {
  throw new Error('Original IndexNow key file is missing. Deployment stopped.');
}

const keyContents = fs.readFileSync(ROOT_KEY_FILE, 'utf8').trim();

if (keyContents !== KEY) {
  throw new Error('IndexNow key file content does not match the configured key.');
}

// Read and preserve the original redirect rules.
const redirectContents = fs.readFileSync(ROOT_REDIRECTS, 'utf8');

const redirectRules = redirectContents
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.trim().startsWith('#'));

if (redirectRules.length > 2000) {
  throw new Error(`Redirect limit check failed: ${redirectRules.length} rules found.`);
}

const inputUrls = fs.readFileSync(URLS_FILE, 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

const urls = new Set();

for (const value of inputUrls) {
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

  // Standardize sitemap URLs to HTTPS.
  url.protocol = 'https:';

  // Remove duplicate slashes from the pathname.
  url.pathname = '/' + url.pathname.split('/').filter(Boolean).join('/');

  urls.add(url.href);
}

if (urls.size === 0) {
  throw new Error('No valid URLs found. Deployment stopped.');
}

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Copy original files into the actual deployment directory.
fs.copyFileSync(ROOT_REDIRECTS, PUBLIC_REDIRECTS);
fs.copyFileSync(ROOT_KEY_FILE, PUBLIC_KEY_FILE);

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

// Final deployment checks.
if (!fs.existsSync(PUBLIC_REDIRECTS)) {
  throw new Error('public/_redirects is missing. Deployment stopped.');
}

if (
  fs.readFileSync(PUBLIC_REDIRECTS, 'utf8') !== redirectContents
) {
  throw new Error('Redirect file differs from the original. Deployment stopped.');
}

if (fs.readFileSync(PUBLIC_KEY_FILE, 'utf8').trim() !== KEY) {
  throw new Error('Deployed IndexNow key file validation failed.');
}

if (!fs.existsSync(SITEMAP_FILE)) {
  throw new Error('Sitemap was not generated.');
}

console.log(`Sitemap URLs: ${urls.size}`);
console.log(`lastmod: ${lastmod}`);
console.log('changefreq: hourly');
console.log(`Redirect rules copied and verified: ${redirectRules.length}`);
console.log('IndexNow key copied and verified.');
console.log('All build checks passed.');
