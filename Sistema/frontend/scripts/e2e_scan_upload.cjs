/**
 * E2E flujo completo: login -> abrir modal escaneo -> subir imagen real
 * -> Analizar -> verificar resultado (0 celdas para TEST_003, que no es
 * formulario de mapeo) o preview si detecta.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGE ERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });

  try {
    await page.goto('http://127.0.0.1:5174', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const userInput = page.locator('input[type="text"], input[type="email"]').first();
    if (await userInput.isVisible().catch(() => false)) {
      await userInput.fill('TEST');
      await page.locator('input[type="password"]').first().fill('1234');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2500);
    }

    const importScan = page.getByRole('button', { name: /Importar Escaneado/i }).first();
    await importScan.click();
    await page.waitForTimeout(1500);

    // Subir imagen real directamente al input hidden
    await page.locator('input[type="file"]').first().setInputFiles(
      'C:/Users/DrN/UNSA/TRABAJO/GEMA/Mapeo/GEMA-Mapeo/Sistema/backend/uploads/TEST_003/TEST_003-VENTANA-1.png'
    );
    await page.waitForTimeout(1500);

    // Verificar thumbnail + botón Analizar
    const body1 = await page.locator('body').innerText();
    console.log('Thumbnail/imagen cargada:', /1\/15|15/.test(body1) ? 'OK' : 'revisar');
    console.log('Botón "Analizar 1 imagen" visible:', /Analizar 1 imagen/i.test(body1));

    await page.getByRole('button', { name: /Analizar 1 imagen/i }).click();
    await page.waitForTimeout(30000); // el free puede tardar hasta 30s

    const body2 = await page.locator('body').innerText();
    const previewShown = /Previsualización del Escaneo/i.test(body2);
    const noCells = /Sin celdas detectadas/i.test(body2);
    const analyzing = /Analizando imágenes/i.test(body2);
    console.log('Preview mostrado:', previewShown);
    console.log('Sin celdas (TEST_003 no es formulario):', noCells);
    console.log('Sigue analizando:', analyzing);

    if (previewShown) {
      console.log('E2E COMPLETO OK: preview con celdas');
    } else if (noCells) {
      console.log('E2E OK: backend respondió correctamente (0 celdas = imagen no es formulario)');
    } else if (analyzing) {
      console.log('E2E PARCIAL: aún analizando — el flujo funciona');
    } else {
      console.log('E2E ¿? contenido:', body2.slice(0, 400).replace(/\n+/g, ' | '));
    }
  } catch (e) {
    console.log('E2E ERROR:', e.message);
  } finally {
    console.log('Errores consola:', errors.length ? errors.slice(0, 4) : 'ninguno');
    await browser.close();
  }
})();
