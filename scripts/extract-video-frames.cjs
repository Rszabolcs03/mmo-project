const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

const videoPath = path.resolve(process.argv[2] || '');
const outputDirectory = path.resolve(process.argv[3] || path.join(process.cwd(), '.tmp', 'video-frames'));
const frameCount = Math.max(4, Number.parseInt(process.argv[4] || '12', 10));
const requestedStart = Math.max(0, Number.parseFloat(process.argv[5] || '0'));
const requestedEnd = Number.parseFloat(process.argv[6] || '');

if (!fs.existsSync(videoPath)) {
  console.error(`Video not found: ${videoPath}`);
  process.exit(1);
}

const electronProfileDirectory = path.join(outputDirectory, '.electron-profile');
fs.mkdirSync(electronProfileDirectory, { recursive: true });
app.setPath('userData', electronProfileDirectory);
app.setPath('cache', path.join(electronProfileDirectory, 'cache'));
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('use-gl', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.disableHardwareAcceleration();
let mediaServer;

const watchdog = setTimeout(() => {
  console.error('Video extraction exceeded the hard 60-second limit and was stopped.');
  mediaServer?.close();
  app.exit(1);
}, 60000);
watchdog.unref();

app.whenReady().then(async () => {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const window = new BrowserWindow({
    width: 960,
    height: 540,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      partition: 'video-reviewer',
      sandbox: false,
      webSecurity: false,
    },
  });
  const videoStats = fs.statSync(videoPath);
  mediaServer = http.createServer((request, response) => {
    if (request.url !== '/video') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><html><body></body></html>');
      return;
    }

    const range = request.headers.range;
    if (!range) {
      response.writeHead(200, {
        'Accept-Ranges': 'bytes',
        'Content-Length': videoStats.size,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(videoPath).pipe(response);
      return;
    }

    const [startText, endText] = range.replace('bytes=', '').split('-');
    const start = Math.max(0, Number.parseInt(startText || '0', 10));
    const end = Math.min(
      videoStats.size - 1,
      Number.parseInt(endText || `${videoStats.size - 1}`, 10),
    );
    response.writeHead(206, {
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${videoStats.size}`,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(videoPath, { start, end }).pipe(response);
  });
  await new Promise((resolve, reject) => {
    mediaServer.once('error', reject);
    mediaServer.listen(0, '127.0.0.1', resolve);
  });
  const address = mediaServer.address();
  const port = typeof address === 'object' && address ? address.port : null;
  if (!port) throw new Error('Video review server did not receive a port.');
  const readyResponse = await fetch(`http://127.0.0.1:${port}/`);
  if (!readyResponse.ok) throw new Error('Video review server did not answer HTTP.');
  await window.loadURL(`http://127.0.0.1:${port}/`);
  const videoUrl = `http://127.0.0.1:${port}/video`;
  const result = await window.webContents.executeJavaScript(`
    (() => new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.src = ${JSON.stringify(videoUrl)};
      const timeout = setTimeout(() => reject(new Error('Timed out loading video')), 30000);

      video.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error(video.error?.message || 'Video decode failed'));
      }, { once: true });

      video.addEventListener('loadedmetadata', async () => {
        clearTimeout(timeout);
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const startTime = Math.min(duration, ${requestedStart});
        const endTime = Number.isFinite(${requestedEnd})
          ? Math.max(startTime, Math.min(duration, ${Number.isFinite(requestedEnd) ? requestedEnd : 'Number.NaN'}))
          : duration;
        const scale = Math.min(1, 960 / video.videoWidth, 540 / video.videoHeight);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        const frames = [];

        const seek = (time) => new Promise((seekResolve, seekReject) => {
          const seekTimeout = setTimeout(() => seekReject(new Error('Seek timed out')), 10000);
          video.addEventListener('seeked', () => {
            clearTimeout(seekTimeout);
            seekResolve();
          }, { once: true });
          video.currentTime = Math.max(0, Math.min(duration, time));
        });

        for (let index = 0; index < ${frameCount}; index += 1) {
          const time = duration <= 0
            ? 0
            : startTime + ((endTime - startTime) * index) / Math.max(1, ${frameCount} - 1);
          await seek(time);
          context.drawImage(video, 0, 0, width, height);
          frames.push({
            time,
            dataUrl: canvas.toDataURL('image/png'),
          });
        }
        resolve({ duration, height, width, frames });
      }, { once: true });
    }))()
  `, true);

  result.frames.forEach((frame, index) => {
    const data = frame.dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(
      path.join(outputDirectory, `frame-${String(index).padStart(2, '0')}.png`),
      Buffer.from(data, 'base64'),
    );
  });
  fs.writeFileSync(
    path.join(outputDirectory, 'metadata.json'),
    JSON.stringify({
      duration: result.duration,
      height: result.height,
      width: result.width,
      times: result.frames.map((frame) => frame.time),
    }, null, 2),
  );
  console.log(`Extracted ${result.frames.length} frames from ${result.duration.toFixed(2)}s video.`);
  clearTimeout(watchdog);
  mediaServer.close();
  window.destroy();
  app.quit();
}).catch((error) => {
  clearTimeout(watchdog);
  mediaServer?.close();
  console.error(error);
  app.quit();
  process.exitCode = 1;
});
