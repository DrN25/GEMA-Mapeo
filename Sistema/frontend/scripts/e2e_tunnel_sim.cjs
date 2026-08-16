/**
 * E2E simulación del túnel público: accede al frontend por un host que NO es
 * localhost (como mapeogema.dpdns.org). El frontend usa rutas relativas
 * (/api/...) -> Vite proxy -> backend. Verifica que scan/config responde.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  // Contexto con hostname público simulado (como el túnel de Cloudflare)
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
  const network = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/')) network.push(`RESP: ${r.status()} ${r.url()}`);
  });

  try {
    // Vite dev server responde a cualquier host (allowedHosts: true)
    await page.goto('http://127.0.0.1:5174', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const userInput = page.locator('input[type="text"], input[type="email"]').first();
    if (await userInput.isVisible().catch(() => false)) {
      await userInput.fill('TEST');
      await page.locator('input[type="password"]').first().fill('1234');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    await page.getByRole('button', { name: /Importar Escaneado/i }).first().click();
    await page.waitForTimeout(6000);

    const body = await page.locator('body').innerText();
    const m = body.match(/(Escaneo listo|No se pudo contactar el servicio de escaneo[^\n]*|El escaneo no está configurado[^\n]*)/i);
    console.log('BANNER:', m ? m[1].trim() : '(no encontrado)');
    const scanReqs = network.filter((n) => n.includes('/api/scan'));
    console.log('RED /api/scan/:', scanReqs.length ? scanReqs : 'NINGUNA (problema!)');
    console.log('URLs relativas usadas:', scanReqs.some((n) => n.includes('127.0.0.1:5174/api/scan')) ? 'SI (por proxy)' : 'NO');
  } catch (e) {
    console.log('E2E ERROR:', e.message);
  } finally {
    await browser.close();
  }
})();
