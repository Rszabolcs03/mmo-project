const path = require('node:path');
const { appendFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { mkdir, writeFile } = require('node:fs/promises');
const { app, BrowserWindow } = require('electron');
const { PNG } = require('pngjs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  'art',
  'reference',
  'adventurer-fresh-live-ui-contact-sheet.png',
);
const RACE_SPECS = [
  { raceName: 'Human', classNames: ['Mage', 'Hunter', 'Paladin', 'Warrior', 'Priest', 'Rogue'], previewClass: 'Hunter' },
  { raceName: 'Elf', classNames: ['Mage', 'Hunter', 'Priest', 'Rogue'], previewClass: 'Hunter' },
  { raceName: 'Dwarf', classNames: ['Paladin', 'Warrior', 'Hunter', 'Priest', 'Rogue'], previewClass: 'Paladin' },
  { raceName: 'Orc', classNames: ['Warrior', 'Hunter', 'Rogue'], previewClass: 'Warrior' },
  { raceName: 'Undead', classNames: ['Mage', 'Warrior', 'Priest', 'Rogue'], previewClass: 'Priest' },
];
const MAX_RUNTIME_MS = 150_000;
const TRACE_PATH = path.join(PROJECT_ROOT, '.cache', 'character-creation-ui-verifier.log');

mkdirSync(path.dirname(TRACE_PATH), { recursive: true });
writeFileSync(TRACE_PATH, '');
const trace = (message) => appendFileSync(TRACE_PATH, `${new Date().toISOString()} ${message}\n`);

app.commandLine.appendSwitch('use-gl', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

function decodeDataUrl(dataUrl) {
  return PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'));
}

async function writeContactSheet(dataUrls) {
  const images = dataUrls.map(decodeDataUrl);
  const cellWidth = images[0].width;
  const cellHeight = images[0].height;
  const sheet = new PNG({
    width: cellWidth * 8,
    height: cellHeight * RACE_SPECS.length,
    colorType: 6,
  });

  images.forEach((image, index) => {
    PNG.bitblt(
      image,
      sheet,
      0,
      0,
      image.width,
      image.height,
      (index % 8) * cellWidth,
      Math.floor(index / 8) * cellHeight,
    );
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, PNG.sync.write(sheet));
}

async function run() {
  let viteServer;
  let window;
  const timeout = setTimeout(() => {
    process.stderr.write(`Character-creation UI verification exceeded ${MAX_RUNTIME_MS}ms.\n`);
    app.exit(1);
  }, MAX_RUNTIME_MS);

  try {
    trace('starting bounded Vite server');
    const { createServer } = await import('vite');
    viteServer = await createServer({
      root: PROJECT_ROOT,
      logLevel: 'error',
      server: {
        host: '127.0.0.1',
        port: 0,
        strictPort: false,
      },
      plugins: [{
        name: 'character-creation-offline-verification',
        enforce: 'pre',
        transform(code, id) {
          if (!id.replaceAll('\\', '/').endsWith('/src/game/world.js')) return null;
          return {
            code: code.replace('const OFFLINE_DEMO = false;', 'const OFFLINE_DEMO = true;'),
            map: null,
          };
        },
      }],
    });
    await viteServer.listen();
    trace('bounded Vite server ready');

    const address = viteServer.httpServer.address();
    const port = typeof address === 'object' && address ? address.port : null;
    if (!port) throw new Error('The bounded Vite verifier did not receive a port.');

    window = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false,
      webPreferences: {
        partition: 'character-creation-verifier-fresh-v1',
        sandbox: false,
      },
    });
    trace('hidden BrowserWindow created');
    window.webContents.session.webRequest.onCompleted(
      { urls: ['*://*/assets/characters/*'] },
      (details) => {
        if (details.statusCode >= 400) trace(`asset HTTP ${details.statusCode} ${details.url}`);
      },
    );
    window.webContents.session.webRequest.onErrorOccurred(
      { urls: ['*://*/assets/characters/*'] },
      (details) => trace(`asset network error ${details.error} ${details.url}`),
    );
    window.on('closed', () => trace('hidden BrowserWindow closed'));

    const rendererErrors = [];
    window.webContents.on('console-message', ({ level, message, sourceId, lineNumber }) => {
      if (level >= 2 && !message.includes('Electron Security Warning')) {
        rendererErrors.push(message);
        trace(`renderer console level=${level} source=${sourceId ?? 'unknown'}:${lineNumber ?? 0} message=${message}`);
      }
    });
    const appUrl = `http://127.0.0.1:${port}`;
    let readyResponse = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        readyResponse = await fetch(appUrl);
        if (readyResponse.ok) break;
      } catch {
        // The bounded server may need one more event-loop turn on slower hosts.
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!readyResponse?.ok) throw new Error(`Bounded Vite server did not answer at ${appUrl}.`);
    trace('bounded Vite server answered HTTP');
    await window.webContents.session.clearCache();
    await window.loadURL(appUrl);
    trace('application loaded');

    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const raceSpecs = ${JSON.stringify(RACE_SPECS)};
        const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
        const waitFor = async (predicate, description, timeoutMs = 5000) => {
          const startedAt = performance.now();
          while (performance.now() - startedAt < timeoutMs) {
            const value = predicate();
            if (value) return value;
            await sleep(40);
          }
          throw new Error('Timed out waiting for ' + description);
        };
        const preview = () => document.querySelector('.character-preview canvas');
        const previewHash = () => preview()?.toDataURL('image/png') ?? '';
        const currentLabel = (row) => row.querySelector('.appearance-cycle-current strong')?.textContent?.trim() ?? '';
        const settleAfterChange = async (previousLabel, previousHash, rowFinder, description) => {
          await waitFor(() => {
            const row = rowFinder();
            return row && currentLabel(row) !== previousLabel;
          }, description + ' label change');
          try {
            await waitFor(
              () => previewHash() && previewHash() !== previousHash,
              description + ' preview change',
            );
          } catch (error) {
            const appearanceState = [...document.querySelectorAll('.appearance-choice-row')]
              .map((row) => [row.dataset.appearanceKey, currentLabel(row)]);
            throw new Error(
              error.message
              + ' (appearance=' + JSON.stringify(appearanceState)
              + ')',
            );
          }
          await sleep(80);
        };
        const clickNextAndVerify = async (rowFinder, description) => {
          const row = rowFinder();
          if (!row) throw new Error('Missing control: ' + description);
          const beforeLabel = currentLabel(row);
          const beforeHash = previewHash();
          const next = row.querySelector('button[aria-label^="Next "]');
          if (!next) throw new Error('Missing next arrow: ' + description);
          next.click();
          await settleAfterChange(beforeLabel, beforeHash, rowFinder, description);

          const refreshedRow = rowFinder();
          const picker = refreshedRow.querySelector('.appearance-cycle-current');
          picker.click();
          const listbox = await waitFor(
            () => refreshedRow.querySelector('[role="listbox"]'),
            description + ' option picker',
          );
          const current = currentLabel(refreshedRow);
          const alternate = [...listbox.querySelectorAll('[role="option"]')]
            .find((option) => option.textContent.trim() !== current);
          if (!alternate) throw new Error('No alternate picker choice: ' + description);
          const pickerHash = previewHash();
          alternate.click();
          await settleAfterChange(current, pickerHash, rowFinder, description + ' picker');
        };
        const clickCapeAndVerify = async (rowFinder, description) => {
          const initialHash = previewHash();
          let changed = false;
          for (let attempt = 0; attempt < 2 && !changed; attempt += 1) {
            const row = rowFinder();
            const beforeLabel = currentLabel(row);
            row.querySelector('button[aria-label^="Next "]').click();
            await waitFor(() => currentLabel(rowFinder()) !== beforeLabel, description + ' label change');
            try {
              await waitFor(() => previewHash() !== initialHash, description + ' visible silhouette', 7000);
              changed = true;
            } catch {
              // The short cape can be fully hidden by a specific quiver/pose;
              // the long option must still alter the back silhouette.
            }
          }
          if (!changed) throw new Error('Cape choices did not alter the back-facing preview');

          const row = rowFinder();
          row.querySelector('.appearance-cycle-current').click();
          const listbox = await waitFor(() => row.querySelector('[role="listbox"]'), description + ' option picker');
          const noneOption = [...listbox.querySelectorAll('[role="option"]')]
            .find((option) => option.textContent.trim() === 'None');
          if (!noneOption) throw new Error('Cape picker is missing None');
          const visibleHash = previewHash();
          const visibleLabel = currentLabel(row);
          noneOption.click();
          await settleAfterChange(visibleLabel, visibleHash, rowFinder, description + ' removal');
        };
        const selectStep = async (index) => {
          const step = document.querySelectorAll('.creation-stepper button')[index];
          if (!step) throw new Error('Missing creation step ' + index);
          step.click();
          await sleep(120);
        };
        const rotatePreviewTo = async (targetDirection) => {
          const label = () => document.querySelector('.preview-direction-label strong')?.textContent?.trim();
          for (let step = 0; step < 8 && label() !== targetDirection; step += 1) {
            document.querySelector('button[aria-label="Rotate character right"]').click();
            await sleep(140);
          }
          if (label() !== targetDirection) {
            throw new Error('Could not rotate preview to ' + targetDirection + '; current=' + label());
          }
        };
        const reports = [];
        const screenshots = [];

        await waitFor(() => document.querySelector('.creation-stepper'), 'character creation');
        for (const raceSpec of raceSpecs) {
          await selectStep(0);
          const raceCard = [...document.querySelectorAll('.race-card')]
            .find((card) => card.querySelector('strong')?.textContent?.trim() === raceSpec.raceName);
          if (!raceCard) throw new Error('Missing race card: ' + raceSpec.raceName);
          raceCard.click();
          await waitFor(
            () => raceCard.classList.contains('selected'),
            raceSpec.raceName + ' race selection',
          );
          await sleep(80);

          const visibleClassNames = [...document.querySelectorAll('.class-card')]
            .filter((card) => !card.disabled)
            .map((card) => card.querySelector('strong')?.textContent?.trim())
            .filter(Boolean);
          if (
            visibleClassNames.length !== raceSpec.classNames.length
            || !raceSpec.classNames.every((name) => visibleClassNames.includes(name))
          ) {
            throw new Error(
              raceSpec.raceName + ' class restrictions are incorrect: ' + visibleClassNames.join(','),
            );
          }
          for (const allowedClass of raceSpec.classNames) {
            const allowedCard = [...document.querySelectorAll('.class-card')]
              .find((card) => card.querySelector('strong')?.textContent?.trim() === allowedClass);
            if (allowedCard.classList.contains('selected')) continue;
            const beforeClassHash = previewHash();
            allowedCard.click();
            await waitFor(
              () => previewHash() && previewHash() !== beforeClassHash,
              raceSpec.raceName + ' ' + allowedClass + ' class preview',
            );
          }

          const className = raceSpec.previewClass;
          const classCard = [...document.querySelectorAll('.class-card')]
            .find((card) => card.querySelector('strong')?.textContent?.trim() === className);
          if (!classCard) throw new Error('Missing class card: ' + className);
          classCard.click();
          await sleep(180);
          await selectStep(1);
          await waitFor(() => document.querySelector('.appearance-choice-row'), className + ' appearance controls');
          await sleep(350);

          const styleKeys = [...document.querySelectorAll('.appearance-choice-row')]
            .map((row) => row.dataset.appearanceKey)
            .filter((key) => key && key !== 'gender');
          for (const key of styleKeys) {
            if (key === 'capeStyle') await rotatePreviewTo('back');
            const rowFinder = () => document.querySelector('.appearance-choice-row[data-appearance-key="' + key + '"]');
            if (key === 'capeStyle') await clickCapeAndVerify(rowFinder, className + ' ' + key);
            else await clickNextAndVerify(rowFinder, className + ' ' + key);
            if (key === 'capeStyle') await rotatePreviewTo('front');
          }
          await clickNextAndVerify(
            () => document.querySelector('.appearance-choice-row[data-appearance-key="gender"]'),
            className + ' gender',
          );

          const colorLabels = [...document.querySelectorAll('.color-customization-row')]
            .map((row) => row.querySelector('.appearance-field-label strong')?.textContent?.trim())
            .filter(Boolean);
          for (const label of colorLabels) {
            await clickNextAndVerify(
              () => [...document.querySelectorAll('.color-customization-row')]
                .find((row) => row.querySelector('.appearance-field-label strong')?.textContent?.trim() === label),
              className + ' ' + label,
            );
          }

          const directionHashes = [previewHash()];
          const directionLabels = [];
          for (let directionIndex = 0; directionIndex < 8; directionIndex += 1) {
            document.querySelector('button[aria-label="Rotate character right"]').click();
            await sleep(140);
            directionLabels.push(
              document.querySelector('.preview-direction-label strong')?.textContent?.trim(),
            );
            directionHashes.push(previewHash());
          }
          if (new Set(directionHashes.slice(0, 8)).size !== 8) {
            throw new Error(className + ' preview directions are not visually distinct');
          }
          if (directionLabels.join(',') !== 'front-right,right,back-right,back,back-left,left,front-left,front') {
            throw new Error(className + ' preview direction order is incorrect: ' + directionLabels.join(','));
          }

          reports.push({
            raceName: raceSpec.raceName,
            className,
            allowedClasses: visibleClassNames,
            styleControls: styleKeys.length + 1,
            colorControls: colorLabels.length,
            directions: directionLabels,
          });
          screenshots.push(...directionHashes.slice(0, 8));
        }

        return { reports, screenshots };
      })()
    `, true);
    trace(`renderer verification returned ${result.reports.length} race reports`);

    if (rendererErrors.length > 0) {
      throw new Error(`Renderer errors: ${rendererErrors.join(' | ')}`);
    }
    await writeContactSheet(result.screenshots);
    trace(`contact sheet written to ${OUTPUT_PATH}`);
    process.stdout.write(
      `Verified live character-creation arrows, option pickers, visible preview changes, and direction controls for `
      + `${result.reports.length} races and every allowed class card.\nRendered ${OUTPUT_PATH}.\n`,
    );
  } finally {
    trace('cleaning up verifier');
    clearTimeout(timeout);
    if (window && !window.isDestroyed()) window.destroy();
    if (viteServer) await viteServer.close();
  }
}

app.whenReady()
  .then(run)
  .then(() => {
    trace('verification complete');
    app.exit(0);
  })
  .catch((error) => {
    trace(`verification failed: ${error.stack || error.message || error}`);
    process.stderr.write(`${error.stack || error.message || error}\n`);
    app.exit(1);
  });
