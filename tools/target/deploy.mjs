#!/usr/bin/env node
/**
 * Deploy the Target Activities Runtime action.
 *
 * Usage:
 *   DA_TOKEN=eyJ... AIO_RUNTIME_AUTH=<auth> AIO_RUNTIME_NAMESPACE=332794-868ceruleanwhale node tools/target/deploy.mjs
 *
 * Where to get AIO_RUNTIME_AUTH + AIO_RUNTIME_NAMESPACE:
 *   1. Go to https://developer.adobe.com/console
 *   2. Open the "868CeruleanWhale" project → Production workspace
 *   3. Click "Download all" → opens a .json credential file
 *   4. The file contains "runtime" → { "namespace", "auth" }
 *
 * DA_TOKEN: grab from DevTools on da.live (Authorization: Bearer … header).
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));

// ── Env checks ────────────────────────────────────────────────────────────────
const daToken = process.env.DA_TOKEN;
const runtimeAuth = process.env.AIO_RUNTIME_AUTH;
const runtimeNamespace = process.env.AIO_RUNTIME_NAMESPACE || '332794-868ceruleanwhale';
const runtimeApiHost = process.env.AIO_RUNTIME_APIHOST || 'https://adobeioruntime.net';

if (!daToken) {
  console.error('❌  Set DA_TOKEN env var (grab Bearer token from da.live DevTools)');
  process.exit(1);
}
if (!runtimeAuth) {
  console.error('❌  Set AIO_RUNTIME_AUTH env var');
  console.error('   1. Go to https://developer.adobe.com/console');
  console.error('   2. Open "868CeruleanWhale" project → Production workspace');
  console.error('   3. Click "Download all" → get runtime.auth from the JSON');
  process.exit(1);
}

// ── Read Target credentials from DA sheet ─────────────────────────────────────
console.log('📄  Reading credentials from DA sheet…');
const sheetResp = await fetch('https://content.da.live/ynaka-adobe/parts-cat/.da/adobe-target.json', {
  headers: { Authorization: `Bearer ${daToken}` },
});
if (!sheetResp.ok) {
  console.error(`❌  DA sheet read failed: ${sheetResp.status} ${sheetResp.statusText}`);
  process.exit(1);
}
const { data } = await sheetResp.json();
const get = (key) => data.find((r) => r.key === key)?.value;

const clientId = get('clientId');
const clientSecret = get('clientSecret');
const tenant = get('tenant');

if (!clientId || !clientSecret || !tenant) {
  console.error('❌  Missing clientId, clientSecret, or tenant in .da/adobe-target sheet');
  process.exit(1);
}
console.log(`✅  Credentials loaded (tenant: ${tenant})`);

// ── Verify action.zip exists ──────────────────────────────────────────────────
const zipPath = join(dir, 'actions/target/action.zip');
try { readFileSync(zipPath); } catch {
  console.error(`❌  action.zip not found at ${zipPath}`);
  console.error('   Run: cd tools/target/actions/target && zip -j action.zip index.js');
  process.exit(1);
}

// ── Deploy via aio runtime ────────────────────────────────────────────────────
const actionName = 'target-activities';
const cmd = [
  'aio runtime action update',
  `${runtimeNamespace}/default/${actionName}`,
  `"${zipPath}"`,
  '--kind nodejs:18',
  '--web true',
  `--param TARGET_CLIENT_ID "${clientId}"`,
  `--param TARGET_CLIENT_SECRET "${clientSecret}"`,
  `--param TARGET_TENANT "${tenant}"`,
  `-u "${runtimeAuth}"`,
  `--apihost "${runtimeApiHost}"`,
].join(' \\\n  ');

console.log(`\n🚀  Deploying action: ${runtimeNamespace}/default/${actionName}`);
console.log('    (credentials are passed as action params — not in the zip)\n');

try {
  execSync(cmd, { stdio: 'inherit' });
} catch {
  console.error('\n❌  Deployment failed. Run with --verbose for details.');
  process.exit(1);
}

// ── Print the Runtime URL ─────────────────────────────────────────────────────
const nsSlug = runtimeNamespace.replace('_', '-');
const runtimeUrl = `https://${nsSlug}.adobeioruntime.net/api/v1/web/default/${actionName}`;

console.log('\n✅  Deployed successfully!');
console.log(`\n   Runtime URL:\n   ${runtimeUrl}`);
console.log('\n   This is the TARGET_RUNTIME URL in tools/CMS-Tool/cms-tool.js.');
