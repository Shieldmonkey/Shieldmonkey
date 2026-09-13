import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.join(root, 'dist/src/sandbox/index.html');
const html = readFileSync(htmlPath, 'utf8');
const assets = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(match => match[1]);
const uniqueAssets = [...new Set(assets)];
const gzipBytes = uniqueAssets.reduce((total, asset) => {
    const file = path.join(root, 'dist', asset.replace(/^\//, ''));
    statSync(file);
    return total + gzipSync(readFileSync(file)).byteLength;
}, 0);
const budget = 200 * 1024;

if (/ScriptEditor|prettier|standalone|codemirror/i.test(html)) {
    throw new Error('Editor tooling is eagerly referenced by the sandbox entry.');
}
if (gzipBytes > budget) {
    throw new Error(`Sandbox bootstrap is ${(gzipBytes / 1024).toFixed(1)} KiB gzip; budget is 200 KiB.`);
}
console.log(`Sandbox bootstrap: ${(gzipBytes / 1024).toFixed(1)} KiB gzip (budget: 200 KiB)`);
