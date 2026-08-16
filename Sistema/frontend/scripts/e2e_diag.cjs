/**
 * E2E diagnóstico: reproduce el flujo del usuario con compartir_servidor.bat.
 * Login TEST/1234 -> abrir modal escaneo -> capturar TODAS las peticiones
 * de red /api/scan/config con su estado real.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const network = [];
  page.on('pageerror', (e) => errors.push(`PAGE ERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });
  page.on('requestfailed', (r) => network.push(`REQUEST FAILED: ${r.url()} -> ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.url().includes('/api/')) network.push(`RESP: ${r.status()} ${r.url()}`);
  });

  try {
    await page.goto('http://127.0.0.1:5174', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const userInput = page.locator('input[type="text"], input[type="email"]').first();
    if (await userInput.isVisible().catch(() => false)) {
      await userInput.fill('TEST');
      await page.locator('input[type="password"]').first().fill('1234');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    const importScan = page.getByRole('button', { name: /Importar Escaneado/i }).first();
    await importScan.click();
    await page.waitForTimeout(6000); // apiFetch con reintentos: esperar el resultado completo

    const body = await page.locator('body').innerText();
    const m = body.match(/(Escaneo listo|No se pudo contactar el servicio de escaneo[^\n]*|Cargando configuración del escaneo|El escaneo no está configurado[^\n]*)/i);
    console.log('BANNER:', m ? m[1] : '(no encontrado)');

    const scanReqs = network.filter((n) => n.includes('/api/scan'));
    console.log('RED /api/scan/:', scanReqs.length ? scanReqs : 'ninguna');
    const apiReqs = network.filter((n) => n.includes('/api/') && !n.includes('/api/scan'));
    console.log('RED /api/ (otras, muestra):', apiReqs.slice(0, 6));
    console.log('Errores consola:', errors.length ? errors.slice(0, 5) : 'ninguno');
  } catch (e) {
    console.log('E2E ERROR:', e.message);
  } finally {
    await browser.close();
  }
})();
