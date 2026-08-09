import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { extractFile, listPackage } from '@electron/asar';

const root = process.cwd();
const distRoot = join(root, 'dist');
const asarPath = join(root, 'release', 'win-unpacked', 'resources', 'app.asar');

if (!existsSync(distRoot)) {
  throw new Error(`Production client build was not found: ${distRoot}`);
}
if (!existsSync(asarPath)) {
  throw new Error(`Packaged client archive was not found: ${asarPath}`);
}

const sourcePackage = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8'),
);
const archiveEntries = listPackage(asarPath);
const clientBundleEntry = archiveEntries.find(
  (entry) => /^\\dist\\assets\\index-[^\\]+\.js$/i.test(entry),
);
if (!clientBundleEntry) {
  throw new Error('The packaged app does not contain a Vite client bundle.');
}

function extract(entry) {
  return extractFile(asarPath, entry.replace(/^\\/, ''));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function collectFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    // Electron packaging intentionally omits repository-only dotfiles such as
    // empty-directory .gitkeep placeholders.
    if (entry.name.startsWith('.')) continue;
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

const packagedPackage = JSON.parse(extract('\\package.json').toString('utf8'));
if (packagedPackage.version !== sourcePackage.version) {
  throw new Error(
    `Packaged version ${packagedPackage.version} does not match source version ${sourcePackage.version}.`,
  );
}

const distFiles = collectFiles(distRoot);
for (const sourcePath of distFiles) {
  const relativePath = relative(distRoot, sourcePath).replaceAll('/', '\\');
  const archivePath = `\\dist\\${relativePath}`;
  let packagedBuffer;
  try {
    packagedBuffer = extract(archivePath);
  } catch {
    throw new Error(`Packaged client is missing build file: ${relativePath}`);
  }

  if (sha256(readFileSync(sourcePath)) !== sha256(packagedBuffer)) {
    throw new Error(`Packaged build file differs from source build: ${relativePath}`);
  }
}

console.log(
  `Verified packaged client ${sourcePackage.version}: bundle ${clientBundleEntry} `
  + `and ${distFiles.length} exact production build files.`,
);
