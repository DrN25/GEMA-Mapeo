/**
 * Test E2E del modal de escaneo con Playwright.
 * Flujo: login (TEST/1234) -> Dashboard -> abrir "Importar Escaneado"
 * -> verificar banner "Escaneo listo" -> cerrar.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGE ERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`CONSOLE ERROR: ${m.text()}`);
  });

  try {
    await page.goto('http://127.0.0.1:5174', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Login TEST / 1234
    const userInput = page.locator('input[type="text"], input[type="email"], input[placeholder*="usuario" i], input[placeholder*="Usuario" i]').first();
    const passInput = page.locator('input[type="password"]').first();
    await userInput.waitFor({ timeout: 15000 }).catch(async () => {
      // quizá el login ya está recordado; intentar navegar
      console.log('No se encontró input de usuario — puede estar ya logueado');
      return;
    });
    if (await userInput.isVisible().catch(() => false)) {
      await userInput.fill('TEST');
      await passInput.fill('1234');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2500);
    }

    // Dashboard debería mostrar botones de importación
    const importExcel = page.getByRole('button', { name: /Importar Excel/i }).first();
    const importScan = page.getByRole('button', { name: /Importar Escaneado/i }).first();

    if (await importScan.isVisible({ timeout: 20000 }).catch(() => false)) {
      console.log('OK: botón "Importar Escaneado" visible');
      await importScan.click();
      await page.waitForTimeout(2500);

      // Verificar banner de estado del escaneo
      const body = await page.locator('body').innerText();
      const bannerOk = /Escaneo listo/i.test(body);
      const bannerLoading = /Cargando configuración del escaneo/i.test(body);
      const bannerError = /No se pudo contactar el servicio de escaneo/i.test(body);
      const bannerNotConfigured = /no está configurado/i.test(body);
      console.log('Banner "Escaneo listo":', bannerOk);
      console.log('Banner cargando:', bannerLoading);
      console.log('Banner error red:', bannerError);
      console.log('Banner no configurado:', bannerNotConfigured);

      if (bannerOk) {
        console.log('E2E OK: el modal de escaneo ve el backend configurado');
      } else if (bannerError) {
        console.log('E2E FAIL: error de red en config');
      } else {
        console.log('E2E PARCIAL: otro estado del banner');
      }

      // Verificar el modo picker
      console.log('Modo "Escanear en Celda Actual" visible:', /Escanear en Celda Actual/i.test(body));
      console.log('Modo "Escanear Nueva(s) Celda(s)" visible:', /Escanear Nueva/i.test(body));

      // Cerrar modal
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      console.log('FAIL: no se encontró el botón "Importar Escaneado"');
      const body = await page.locator('body').innerText();
      console.log('Contenido visible (primeros 500):', body.slice(0, 500).replace(/\n+/g, ' | '));
    }
  } catch (e) {
    console.log('E2E ERROR:', e.message);
  } finally {
    console.log('Errores de consola:', errors.length > 0 ? errors.slice(0, 5) : 'ninguno');
    await browser.close();
  }
})();
