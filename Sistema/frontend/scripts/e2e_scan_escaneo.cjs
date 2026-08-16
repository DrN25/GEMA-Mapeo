/**
 * E2E frontend con el ESCANEADO real (escaneado-1.png).
 * Login TEST/1234 -> Importar Escaneado -> subir escaneo -> verificar preview.
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
    await page.waitForTimeout(2000);

    const userInput = page.locator('input[type="text"], input[type="email"]').first();
    if (await userInput.isVisible().catch(() => false)) {
      await userInput.fill('TEST');
      await page.locator('input[type="password"]').first().fill('1234');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    await page.getByRole('button', { name: /Importar Escaneado/i }).first().click();
    await page.waitForTimeout(1500);

    await page.locator('input[type="file"]').first().setInputFiles(
      'C:/Users/DrN/Downloads/escaneado-1.png'
    );
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: /Analizar 1 imagen/i }).click();
    await page.waitForTimeout(90000);

    const body = await page.locator('body').innerText();
    const previewShown = /Previsualización del Escaneo/i.test(body);
    const estructuras = body.match(/Discontinuidades Detectadas \((\d+)\)/i);
    const analyzing = /Analizando imágenes/i.test(body);

    console.log('Preview mostrado:', previewShown);
    console.log('Estructuras detectadas:', estructuras ? estructuras[1] : 'N/A');
    console.log('Sigue analizando:', analyzing);

    if (previewShown && estructuras && parseInt(estructuras[1]) >= 5) {
      console.log('E2E FINAL OK: el escaneo se previsualiza con sus estructuras');
    } else {
      console.log('Contenido:', body.slice(0, 400).replace(/\n+/g, ' | '));
    }
  } catch (e) {
    console.log('E2E ERROR:', e.message);
  } finally {
    console.log('Errores consola:', errors.length ? errors.slice(0, 4) : 'ninguno');
    await browser.close();
  }
})();
