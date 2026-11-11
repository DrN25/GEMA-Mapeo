/**
 * test_connection_recovery_e2e.mjs — E2E real (Chromium y Firefox) para detección
 * de caída de backend y recuperación automática sin recargar la página.
 *
 * Usa un servidor HTTP estático sobre `frontend/dist` y un servidor HTTP real en
 * `127.0.0.1:8001` (sin mockear fetch ni interceptar rutas en Playwright).
 *
 * Uso: node Sistema/tests/test_connection_recovery_e2e.mjs
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(TESTS_DIR, '..', 'frontend');
const DIST_DIR = path.join(FRONTEND_DIR, 'dist');

const require = createRequire(path.join(FRONTEND_DIR, 'package.json'));
const { chromium, firefox } = require('playwright');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function ensureDistBuilt() {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.log('[E2E] dist/ no encontrado, ejecutando npm run build...');
    execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit' });
  }
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      let relPath = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
      let filePath = path.join(DIST_DIR, relPath);
      if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function createApiServer() {
  const healthLog = [];
  const server = http.createServer((req, res) => {
    const cleanUrl = (req.url || '').split('?')[0];
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (cleanUrl === '/api/health') {
      healthLog.push({ ts: Date.now(), method: req.method });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (cleanUrl === '/api/auth/me') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        usuario_id: 1,
        usuario: 'E2E_ADMIN',
        email: 'e2e@local',
        nombre_completo: 'E2E Admin',
        rol_id: 1,
        rol_nombre: 'admin',
        geotecnico_id: null,
        estado: true,
      }));
      return;
    }

    if (cleanUrl.startsWith('/api/catalogs')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        lithology_full: [],
        agua: [],
        resistencia: [],
        estructura: [],
        orientacion: [],
        espaciado: [],
        continuidad: [],
        abertura: [],
        relleno: [],
        alteracion: [],
        rugosidad: [],
        forma: [],
        gsi_superficie: [],
        gsi_estructura: [],
      }));
      return;
    }

    if (cleanUrl === '/api/ventanas') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        items: [],
        kpis: { total_windows: 0, total_meters: 0, avg_rmr89: 0, rmr_classes: {} },
        total_filtered: 0,
        total_pages: 1,
        page: 1,
      }));
      return;
    }

    // Safe defaults for background startup requests from App.tsx
    const emptyPayload = {};
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(emptyPayload));
  });

  const listen = () => new Promise((resolve, reject) => {
    const onErr = (err) => {
      server.removeListener('listening', onListen);
      reject(err);
    };
    const onListen = () => {
      server.removeListener('error', onErr);
      resolve();
    };
    server.once('error', onErr);
    server.once('listening', onListen);
    server.listen(8001, '127.0.0.1');
  });

  const stop = () => new Promise((resolve) => {
    if (!server.listening) return resolve();
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close(() => resolve());
  });

  return { server, listen, stop, healthLog };
}

function resolveExecutable(browserType, browserName) {
  const defaultExe = browserType.executablePath();
  if (defaultExe && fs.existsSync(defaultExe)) return defaultExe;

  const baseDir = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'ms-playwright')
    : path.join(process.env.HOME || '', '.cache', 'ms-playwright');

  if (fs.existsSync(baseDir)) {
    const prefix = browserName === 'Chromium' ? 'chromium-' : 'firefox-';
    const dirs = fs.readdirSync(baseDir).filter(d => d.startsWith(prefix)).sort().reverse();
    for (const d of dirs) {
      const candidates = browserName === 'Chromium'
        ? [path.join(baseDir, d, 'chrome-win64', 'chrome.exe'), path.join(baseDir, d, 'chrome-linux', 'chrome')]
        : [path.join(baseDir, d, 'firefox', 'firefox.exe'), path.join(baseDir, d, 'firefox', 'firefox')];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }
  }
  return undefined;
}

async function launchBrowser(browserType, browserName) {
  const exe = resolveExecutable(browserType, browserName);
  return browserType.launch({
    ...(exe ? { executablePath: exe } : {}),
    headless: true,
  });
}

async function openConfiguredPage(browser, browserName, frontendUrl, configOverride) {
  const context = await browser.newContext(
    browserName === 'Chromium' ? { viewport: { width: 1280, height: 800 } } : { viewport: null }
  );
  await context.addInitScript((override) => {
    localStorage.setItem('gema_auth_token', 'e2e.test.token');
    localStorage.setItem('gema_auth_user', JSON.stringify({
      usuario_id: 1,
      usuario: 'E2E_ADMIN',
      email: 'e2e@local',
      nombre_completo: 'E2E Admin',
      rol_id: 1,
      rol_nombre: 'admin',
      geotecnico_id: null,
      estado: true,
    }));
    localStorage.setItem('geolog_window_current_view', 'dashboard');
    globalThis.__GEMA_CONNECTION_CONFIG__ = override;
  }, configOverride);

  const page = await context.newPage();
  await page.goto(frontendUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return { context, page };
}

async function testDropAndAutoRecovery(browserType, browserName, frontendUrl, apiCtrl) {
  console.log(`\n--- [${browserName}] Test 1: Modal tras caída y cierre automático ---`);
  await apiCtrl.listen();
  const browser = await launchBrowser(browserType, browserName);
  const { context, page } = await openConfiguredPage(browser, browserName, frontendUrl, {
    activeIntervalMs: 700,
    hiddenIntervalMs: 700,
    keepAwakeMs: 60000,
    stopPingsAfterKeepAwake: false,
    pingTimeoutMs: 1000,
    confirmTimeoutMs: 700,
    confirmMaxAttempts: 2,
    confirmRetryDelayMs: 100,
    reconnectIntervalMs: 500,
  });

  try {
    const modalHeading = page.locator('h3:has-text("Conexión con el servidor perdida")');
    await page.waitForTimeout(1600);
    assert.equal(await modalHeading.isVisible().catch(() => false), false, 'Modal no debe mostrarse estando online');
    assert.ok(apiCtrl.healthLog.length >= 1, 'Debe haber recibido al menos 1 heartbeat estando online');

    // (i) Apagar servidor HTTP real en 8001 -> el modal debe aparecer
    const tDrop = Date.now();
    await apiCtrl.stop();
    await modalHeading.waitFor({ state: 'visible', timeout: 10000 });
    const dropToModalMs = Date.now() - tDrop;
    const retryingVis = await page.locator('span:has-text("El servidor no responde, reintentando")').isVisible();
    const btnReload = await page.getByRole('button', { name: /Recargar página/i }).isVisible();
    const btnRetry = await page.getByRole('button', { name: /Reintentar conexión/i }).isVisible();
    assert.equal(retryingVis, true, 'Debe mostrar texto genérico de reintento');
    assert.equal(btnReload && btnRetry, true, 'Debe conservar los 2 botones del modal');
    console.log(`  [${browserName}] (i) Modal visible tras caída real en ${dropToModalMs} ms`);

    // (ii) Volver a levantar servidor en 8001 -> debe cerrar automáticamente sin recargar
    const navBefore = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    const tRecover = Date.now();
    await apiCtrl.listen();
    await modalHeading.waitFor({ state: 'hidden', timeout: 10000 });
    const recoverToCloseMs = Date.now() - tRecover;
    const navAfter = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    assert.equal(navAfter, navBefore, 'No debe haber recargado la página para cerrar el modal');
    console.log(`  [${browserName}] (ii) Modal cerrado automáticamente sin reload en ${recoverToCloseMs} ms`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await apiCtrl.stop();
  }
}

async function testKeepAwakeStops(browserType, browserName, frontendUrl, apiCtrl) {
  console.log(`\n--- [${browserName}] Test 2: Detener pings tras keepAwakeMs ---`);
  apiCtrl.healthLog.length = 0;
  await apiCtrl.listen();
  const browser = await launchBrowser(browserType, browserName);
  const { context, page } = await openConfiguredPage(browser, browserName, frontendUrl, {
    activeIntervalMs: 700,
    hiddenIntervalMs: 700,
    keepAwakeMs: 2400,
    stopPingsAfterKeepAwake: true,
    pingTimeoutMs: 1000,
    confirmTimeoutMs: 700,
    confirmMaxAttempts: 2,
    confirmRetryDelayMs: 100,
    reconnectIntervalMs: 500,
  });

  try {
    const startTs = Date.now();
    await page.waitForTimeout(2800);
    const countBeforeStop = apiCtrl.healthLog.filter(x => x.ts >= startTs).length;
    assert.ok(countBeforeStop >= 2, `Esperaba >=2 pings antes de keepAwakeMs, hubo ${countBeforeStop}`);

    // Esperar ventana silenciosa sin interacción (4 segundos más)
    const quietStartTs = Date.now();
    await page.waitForTimeout(4000);
    const countDuringQuiet = apiCtrl.healthLog.filter(x => x.ts >= quietStartTs).length;
    assert.equal(countDuringQuiet, 0, `Esperaba 0 pings después de keepAwakeMs, hubo ${countDuringQuiet}`);
    console.log(`  [${browserName}] Pings antes=${countBeforeStop}, pings tras keepAwakeMs=${countDuringQuiet}`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await apiCtrl.stop();
  }
}

async function main() {
  ensureDistBuilt();
  const staticSrv = await startStaticServer();
  const apiCtrl = createApiServer();
  try {
    for (const [bType, bName] of [[chromium, 'Chromium'], [firefox, 'Firefox']]) {
      await testDropAndAutoRecovery(bType, bName, staticSrv.url, apiCtrl);
      await testKeepAwakeStops(bType, bName, staticSrv.url, apiCtrl);
    }
    console.log('\n[PASS] Todos los tests E2E de conexión y recuperación pasaron en Chromium y Firefox.');
  } finally {
    await apiCtrl.stop();
    await new Promise(r => staticSrv.server.close(r));
  }
}

main().catch((err) => {
  console.error('\n[FAIL] Error en test_connection_recovery_e2e:', err);
  process.exit(1);
});

