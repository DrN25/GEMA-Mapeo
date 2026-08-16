/**
 * E2E final con la imagen REAL del usuario: subir captura -> analizar ->
 * verificar que el preview muestra la celda "(sin nombre)" con estructuras.
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
      'C:/Users/DrN/Downloads/Captura de pantalla 2026-08-14 213610.png'
    );
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: /Analizar 1 imagen/i }).click();
    await page.waitForTimeout(60000); // free lento + verificación con pago

    const body = await page.locator('body').innerText();
    const previewShown = /Previsualización del Escaneo/i.test(body);
    const noData = /No se pudieron extraer datos/i.test(body);
    const sinNombre = /sin nombre/i.test(body);
    const estructuras = body.match(/Discontinuidades Detectadas \((\d+)\)/i);
    const analyzing = /Analizando imágenes/i.test(body);

    console.log('Preview mostrado:', previewShown);
    console.log('Mensaje "no se pudieron extraer":', noData);
    console.log('Celda "(sin nombre)":', sinNombre);
    console.log('Estructuras detectadas:', estructuras ? estructuras[1] : 'N/A');
    console.log('Sigue analizando:', analyzing);

    if (previewShown && sinNombre && estructuras && parseInt(estructuras[1]) >= 5) {
      console.log('E2E FINAL OK: tu imagen se previsualiza con estructuras y sin nombre (como debe ser)');
    } else if (noData) {
      console.log('E2E FAIL: llegó el mensaje de no extracción');
      console.log('Contenido:', body.slice(0, 500).replace(/\n+/g, ' | '));
    } else if (analyzing) {
      console.log('E2E PARCIAL: aún analizando');
    }
  } catch (e) {
    console.log('E2E ERROR:', e.message);
  } finally {
    console.log('Errores consola:', errors.length ? errors.slice(0, 4) : 'ninguno');
    await browser.close();
  }
})();
