import { readFileSync } from 'fs';

/**
 * Loads secrets from a JSON file when SECRETS_JSON is set.
 * JSON keys take priority over environment variables.
 *
 * Example env-secrets/google.json:
 *   {
 *     "GOOGLE_CLIENT_ID":     "...",
 *     "GOOGLE_CLIENT_SECRET": "...",
 *     "GOOGLE_CALLBACK_URL":  "http://localhost:3001/api/auth/google/callback"
 *   }
 */
const jsonSecrets = (() => {
  const path = process.env.SECRETS_JSON;
  if (!path) return {};
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));

    // Google Cloud Console format: { "web": { "client_id": ..., "client_secret": ..., "redirect_uris": [...] } }
    const goog = raw.web ?? raw.installed;
    if (goog) {
      return {
        GOOGLE_CLIENT_ID:     goog.client_id,
        GOOGLE_CLIENT_SECRET: goog.client_secret,
        GOOGLE_CALLBACK_URL:  goog.redirect_uris?.[0],
      };
    }

    // Flat format: { "GOOGLE_CLIENT_ID": ..., ... }
    return raw;
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.warn(`[secrets] SECRETS_JSON not found at "${path}" — Google OAuth will be disabled`);
      return {};
    }
    throw new Error(`Cannot parse SECRETS_JSON at "${path}": ${e.message}`);
  }
})();

/**
 * Reads a secret with the following priority:
 *   1. JSON file (SECRETS_JSON)
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
