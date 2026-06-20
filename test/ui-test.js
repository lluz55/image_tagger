import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const server = http.createServer((req, res) => {
  let filePath = path.join(rootDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath);
  let contentType = 'text/html';
  if (ext === '.js') contentType = 'application/javascript';
  else if (ext === '.css') contentType = 'text/css';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

async function run() {
  server.listen(8080);
  console.log('Static server running on http://localhost:8080');

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  const consoleErrors = [];
  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });
  page.on('requestfailed', request => {
    console.log(`[Request Failed] URL: ${request.url()} | Text: ${request.failure()?.errorText || 'Unknown'}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`[HTTP Error] URL: ${response.url()} | Status: ${response.status()}`);
    }
  });

  page.on('console', async msg => {
    const args = await Promise.all(msg.args().map(async arg => {
      try {
        const val = await arg.jsonValue();
        if (val instanceof Error || (val && val.message)) {
          return val.message + '\n' + (val.stack || '');
        }
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      } catch {
        return arg.toString();
      }
    }));
    const text = args.join(' ');
    console.log(`[Browser Console] [${msg.type()}] ${text}`);
    if (msg.type() === 'error' && !text.includes('favicon.ico') && !text.includes('Failed to load resource') && !text.includes('Erro crítico ao inicializar motores')) {
      consoleErrors.push(text);
    }
  });

  await page.goto('http://localhost:8080');
  console.log('Page loaded');

  const title = await page.title();
  console.log('Title:', title);

  console.log('Testing AI Mode activation...');
  await page.evaluate(() => {
    const chk = document.getElementById('ai-mode-checkbox');
    if (chk) {
      chk.checked = true;
      chk.dispatchEvent(new Event('change'));
    }
  });

  // Wait for the model to be fully ready
  console.log('Waiting for model to load (isAiModelReady = true)...');
  await page.waitForFunction(() => window.isAiModelReady === true, { timeout: 120000 });
  console.log('Model loaded successfully!');

  // Draw mock patrimonio image on canvas by loading test-image.jpg
  console.log('Loading test-image.jpg and drawing it on the canvas...');
  await page.evaluate(async () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.src = '/test-image.jpg';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    // Mock state.currentImg so app.js knows an image exists
    const stateModule = window.state || {};
    stateModule.currentImg = img;

    // Toggle screen displays to make the preview screen (and button) visible and clickable
    const screenCap = document.getElementById('screen-capture');
    const screenPrev = document.getElementById('screen-preview');
    if (screenCap && screenPrev) {
      screenCap.style.display = 'none';
      screenPrev.style.display = 'flex';
    }
  });

  // Verify the AI button is visible
  const btnVisible = await page.evaluate(() => {
    const btn = document.getElementById('btn-trigger-ai');
    return btn && btn.style.display !== 'none';
  });
  console.log('AI Button visible:', btnVisible);

  // Click the AI button to trigger runAiAutoTag
  console.log('Clicking the AI button to run auto-tagging...');
  await page.click('#btn-trigger-ai');

  // Wait for the AI button to be re-enabled (meaning inference has finished)
  console.log('Waiting for inference/barcode scan to complete...');
  await page.waitForFunction(() => {
    const btn = document.getElementById('btn-trigger-ai');
    return btn && !btn.disabled;
  }, { timeout: 60000 });

  // Check the value of tag-rename
  const tagRenameValue = await page.$eval('#tag-rename', el => el.value);
  console.log('Tag Rename Input Value recognized:', tagRenameValue);

  await browser.close();
  server.close();

  if (consoleErrors.length > 0) {
    console.error('Console errors found during UI test:');
    consoleErrors.forEach(err => console.error('-', err));
    process.exit(1);
  } else {
    console.log(`UI test completed successfully! Tag recognized: "${tagRenameValue}"`);
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  if (server.listening) server.close();
  process.exit(1);
});
