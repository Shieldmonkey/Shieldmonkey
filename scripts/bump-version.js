import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const files = [
  'package.json',
  'src/manifest.json',
  'src/manifest.firefox.json',
];

const packageJsonPath = path.resolve(rootDir, 'package.json');
const currentVersion = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version;

let nextVersion = process.argv[2];
const usage = 'Usage: node scripts/bump-version.js <new_version|major|minor|patch>';

if (!nextVersion) {
  console.error(usage);
  process.exit(1);
}

const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;

if (['major', 'minor', 'patch'].includes(nextVersion)) {
  const match = currentVersion.match(semverRegex);
  if (!match) {
    console.error(`Current version ${currentVersion} is not valid semver.`);
    process.exit(1);
  }
  let [_, major, minor, patch] = match.map(Number);
  
  if (nextVersion === 'major') {
    major++;
    minor = 0;
    patch = 0;
  } else if (nextVersion === 'minor') {
    minor++;
    patch = 0;
  } else if (nextVersion === 'patch') {
    patch++;
  }
  nextVersion = `${major}.${minor}.${patch}`;
} else if (!semverRegex.test(nextVersion)) {
    console.error(`Invalid version format: ${nextVersion}. Expected X.Y.Z or major/minor/patch`);
    process.exit(1);
}

console.log(`Bumping version to ${nextVersion}...`);

for (const file of files) {
  const filePath = path.resolve(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const oldVersion = content.version;
  content.version = nextVersion;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`Updated ${file}: ${oldVersion} -> ${nextVersion}`);
}

// Sync pnpm-lock.yaml
try {
    console.log('Syncing pnpm-lock.yaml...');
    execSync('pnpm install --no-frozen-lockfile', { stdio: 'inherit', cwd: rootDir });
} catch (e) {
    console.error('Failed to sync pnpm-lock.yaml', e);
    process.exit(1);
}

console.log('✅ Version bump complete.');
console.log('Next steps:');
console.log('  1. git add .');
console.log(`  2. git commit -m "chore: release v${newVersion}"`);
console.log(`  3. git tag v${newVersion}`);
console.log('  4. git push && git push --tags');
