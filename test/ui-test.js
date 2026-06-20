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

  page.on('console', msg => {
    const text = msg.text();
    console.log(`[Browser Console] [${msg.type()}] ${text}`);
    if (msg.type() === 'error' && !text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
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

  // Wait a bit to check for loading/import errors
  await new Promise(resolve => setTimeout(resolve, 3000));

  await browser.close();
  server.close();

  if (consoleErrors.length > 0) {
    console.error('Console errors found during UI test:');
    consoleErrors.forEach(err => console.error('-', err));
    process.exit(1);
  } else {
    console.log('UI test completed successfully with no console errors!');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  if (server.listening) server.close();
  process.exit(1);
});
