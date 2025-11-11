/* eslint-disable */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join as pathJoin, sep as pathSep } from 'node:path';
import https from 'node:https';

/**
 * Fetch the canonical Matter ZCL JSON file from the connectedhomeip repository
 * and store it locally for offline / deterministic revision checks.
 *
 * Environment overrides:
 *  - ZCL_OUT: output path for zcl.json (default: chip/zcl.json)
 *  - ZCL_BRANCH: connectedhomeip branch to fetch from (default: v1.4-branch)
 */
const OUT_PATH = process.env.ZCL_OUT || 'chip/zcl.json';
// Single branch strategy from online only
const BRANCH = process.env.ZCL_BRANCH || 'v1.4-branch';
const ZCL_BASE = `https://raw.githubusercontent.com/project-chip/connectedhomeip/${BRANCH}/src/app/zap-templates/zcl/`;
const ZCL_JSON_URL = ZCL_BASE + 'zcl.json';
const XML_BASE = ZCL_BASE + 'data-model/chip/';
const MANUFACTURERS_URL = ZCL_BASE + 'data-model/manufacturers.xml';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        return resolve(fetchUrl(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

async function main() {
  await mkdir(dirname(OUT_PATH), { recursive: true });
  // Always fetch online from the specified branch
  const data = await fetchUrl(ZCL_JSON_URL);

  // Structural sanity check: this is a ZAP ZCL properties file, expected to include xml roots and files
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    throw new Error(`Downloaded content is not valid JSON: ${e.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.xmlFile)) {
    process.stderr.write('Warning: zcl.json does not contain expected ZAP ZCL properties (xmlFile). Saving anyway for manual inspection.\n');
  }

  await writeFile(OUT_PATH, JSON.stringify(parsed, null, 2));
  process.stderr.write(`Saved ${OUT_PATH}.\n`);

  // Also fetch manufacturers.xml to chip/manufacturers.xml from the same branch
  try {
    const outManu = 'chip/manufacturers.xml';
    const manuContent = await fetchUrl(MANUFACTURERS_URL);
    await writeFile(outManu, manuContent);
    process.stderr.write('Saved chip/manufacturers.xml.\n');
  } catch (e) {
    process.stderr.write(`Warning: failed to fetch manufacturers.xml (${e.message}).\n`);
  }

  // Always fetch XMLs referenced by zcl.json from the same branch under data-model/chip
  const xmlFiles = Array.isArray(parsed.xmlFile) ? parsed.xmlFile : [];
  if (xmlFiles.length === 0) {
    process.stderr.write('No xmlFile entries found; skipping XML fetch.\n');
  } else {
    const outXmlBase = 'chip/xml';
    await mkdir(outXmlBase, { recursive: true });
    let ok = 0;
    let fail = 0;
    for (const fileName of xmlFiles) {
      const relative = fileName.trim();
      try {
        const url = XML_BASE + relative;
        const content = await fetchUrl(url);
        const outPath = pathJoin(outXmlBase, relative.replaceAll('/', pathSep));
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, content);
        ok++;
      } catch (e) {
        fail++;
        process.stderr.write(`Failed XML: ${relative} (${e.message})\n`);
      }
    }
    process.stderr.write(`Fetched XML files: ${ok} ok, ${fail} failed. Output under ${outXmlBase}. Branch=${BRANCH}\n`);
  }
  // Ensure success exit unless an unhandled error occurred
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exitCode = 1;
});
