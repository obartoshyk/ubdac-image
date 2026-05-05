import { readFileSync } from 'fs';

/**
 * Loads secrets from one or more JSON files listed in SECRETS_JSON
 * (comma-separated paths). JSON keys take priority over environment variables.
 *
 * Supported formats per file:
 *   - Google Cloud Console: { "web": { "client_id": ..., "client_secret": ..., "redirect_uris": [...] } }
 *   - Flat:                 { "ANY_KEY": "value", ... }
 */
const jsonSecrets = (() => {
  const paths = (process.env.SECRETS_JSON || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!paths.length) return {};

  const merged = {};
  for (const path of paths) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));

      // Google Cloud Console format
      const goog = raw.web ?? raw.installed;
      if (goog) {
        Object.assign(merged, {
          GOOGLE_CLIENT_ID:     goog.client_id,
          GOOGLE_CLIENT_SECRET: goog.client_secret,
          GOOGLE_CALLBACK_URL:  goog.redirect_uris?.[0],
        });
      } else {
        // Flat format
        Object.assign(merged, raw);
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.warn(`[secrets] file not found at "${path}" — skipping`);
      } else {
        throw new Error(`Cannot parse secrets file at "${path}": ${e.message}`);
      }
    }
  }
  return merged;
})();

/**
 * Reads a secret with the following priority:
 *   1. JSON file(s) (SECRETS_JSON)
 *   2. File at path VAR_FILE
 *   3. Environment variable VAR
 */
export function secret(name) {
  if (name in jsonSecrets) return jsonSecrets[name];

  const filePath = process.env[`${name}_FILE`];
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf8').trim();
    } catch (e) {
      throw new Error(`Cannot read secret file for ${name} at "${filePath}": ${e.message}`);
    }
  }

  return process.env[name];
}
