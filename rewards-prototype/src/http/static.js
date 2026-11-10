// Static files for the front end (docs/API.md §2 item 6).
//
// Rules protected here:
//   * The set of servable files is fixed at start by walking public/ once. A request path
//     is looked up in that list as an exact string. It is never decoded, normalised or
//     joined to a directory, so "..", "%2e%2e", a backslash or a NUL byte cannot name
//     anything that is not on the list.
//   * Dotfiles and anything inside a dot-directory are never listed, nor are symbolic
//     links (a link could point outside public/), nor a file type this server has no
//     content type for.
//   * Member photos must never be placed in public/: everything here is readable by
//     anyone who can reach the server, signed in or not.

import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
});

// File and folder names that need no escaping in a URL. Anything else is left unlisted.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_DEPTH = 6;

function walk(directory, urlPrefix, depth, files) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    // No public/ folder yet simply means there is nothing to serve.
    return;
  }
  for (const entry of entries) {
    if (!SAFE_NAME.test(entry.name)) continue;
    const urlPath = `${urlPrefix}/${entry.name}`;
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) walk(filePath, urlPath, depth + 1, files);
    else if (entry.isFile()) {
      const contentType = CONTENT_TYPES[extname(entry.name).toLowerCase()];
      if (contentType) files.set(urlPath, Object.freeze({ filePath, contentType }));
    }
  }
}

/**
 * @param {{ publicDir: string }} options
 */
export function createStaticFiles({ publicDir }) {
  const files = new Map();
  walk(publicDir, '', 0, files);
  // The app is a single screen: the origin itself shows it.
  if (files.has('/index.html')) files.set('/', files.get('/index.html'));

  return Object.freeze({
    /**
     * @param {string} pathname  the raw request path, exactly as received
     * @returns {Promise<{ contentType: string, content: Buffer } | null>} null when the path is not on the list
     */
    async read(pathname) {
      const entry = files.get(pathname);
      if (!entry) return null;
      try {
        return { contentType: entry.contentType, content: await readFile(entry.filePath) };
      } catch {
        // Listed at start but gone since: the honest answer is "not found".
        return null;
      }
    },

    /** The URL paths that can be served, for tests and start-up logs. */
    paths() {
      return [...files.keys()].sort();
    },
  });
}
