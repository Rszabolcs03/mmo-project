import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const releaseDir = path.join(root, 'release');
const updatesDir = path.join(root, 'updates');
const packagePath = path.join(root, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = packageJson.version;
const isMac = process.platform === 'darwin';
const manifestName = isMac ? 'latest-mac.yml' : 'latest.yml';
const releaseDate = new Date().toISOString();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function copyIfExists(fileName) {
  const source = path.join(releaseDir, fileName);
  if (!fs.existsSync(source)) return false;
  fs.copyFileSync(source, path.join(updatesDir, fileName));
  return true;
}

function findArtifact() {
  const files = fs.readdirSync(releaseDir);
  const matchers = isMac
    ? [
        (file) => file.endsWith('.dmg') && file.includes(version),
        (file) => file.endsWith('.zip') && file.includes(version),
      ]
    : [(file) => file.endsWith('.exe') && file.includes('Setup') && file.includes(version)];

  for (const matcher of matchers) {
    const match = files.find(matcher);
    if (match) return match;
  }

  return null;
}

function writeSimpleManifest(artifactName) {
  const manifestPath = path.join(updatesDir, manifestName);
  const content = [
    `version: ${version}`,
    `path: ${artifactName}`,
    `releaseDate: '${releaseDate}'`,
    '',
  ].join('\n');

  fs.writeFileSync(manifestPath, content, 'utf8');
}

assert(fs.existsSync(releaseDir), 'release folder does not exist. Run an Electron dist build first.');
fs.mkdirSync(updatesDir, { recursive: true });

const artifactName = findArtifact();
assert(
  artifactName,
  isMac
    ? `Could not find a Mac artifact for version ${version} in ${releaseDir}. Run npm run electron:dist:mac on a Mac first.`
    : `Could not find a Windows installer for version ${version} in ${releaseDir}. Run npm run electron:dist:win first.`,
);

const releaseFiles = fs.readdirSync(releaseDir);
for (const fileName of releaseFiles) {
  const shouldCopy = isMac
    ? fileName === artifactName || fileName === `${artifactName}.blockmap` || fileName === 'latest-mac.yml'
    : fileName === artifactName || fileName === `${artifactName}.blockmap` || fileName === 'latest.yml';

  if (shouldCopy) copyIfExists(fileName);
}

if (!fs.existsSync(path.join(updatesDir, manifestName))) {
  writeSimpleManifest(artifactName);
}

console.log('Copied update files to:');
console.log(`  ${updatesDir}`);
console.log('');
console.log('Update manifest:');
console.log(`  ${manifestName}`);
console.log(`  version: ${version}`);
console.log(`  artifact: ${artifactName}`);
