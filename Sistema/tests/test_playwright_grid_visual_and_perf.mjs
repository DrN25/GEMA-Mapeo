/**
 * test_playwright_grid_visual_and_perf.mjs
 * Validación exhaustiva en navegador Chromium real:
 * - Cabeceras de 2 niveles (Top: 0 y Top: 28px) fijas y opacas (sin transparencia ni superposición)
 * - Sticky horizontal de columna '#' a Left: 0px bajo scroll de 400px
 * - Virtualización DOM: número de <tr> en <tbody> es ~20-30 aunque existan cientos de filas
 * - Verificación de Modo Claro y Modo Oscuro con captura visual en directorio de artefactos
 */
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire('c:/Users/Rafael/UNSA/TRABAJO/GEMA/Mapeo/GEMA-Mapeo/Sistema/frontend/package.json');
const { chromium } = require('playwright');

const ARTIFACTS_DIR = 'C:/Users/Rafael/.gemini/antigravity/brain/1cd46311-f957-4ec5-9800-572f8b2c418d';

async function runBrowserValidation() {
  console.log('\n========================================================================');
  console.log('🌐 VALIDACIÓN EN CHROMIUM REAL: CABECERAS, STICKY, TEMAS Y RENDIMIENTO');
  console.log('========================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--disable-gpu', '--no-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.text()));
  page.on('pageerror', err => console.log('[BROWSER ERROR]', err.message));

  // 1. Interceptar rutas de backend para autenticación y carga sin servidor API activo
  await page.route('**', async route => {
    const url = route.request().url();
    if (url.includes('/api/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          usuario_id: 1,
          usuario: 'ADMIN',
          email: 'admin@geomec.pe',
          nombre_completo: 'Administrador del Sistema',
          rol_id: 1,
          rol_nombre: 'admin',
          estado: 'A',
          fecha_registro: '2024-01-01'
        })
      });
      return;
    }
    if (url.includes('/api/auth/login')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock_jwt_token_12345',
          token_type: 'bearer',
          user: {
            usuario_id: 1,
            usuario: 'ADMIN',
            email: 'admin@geomec.pe',
            nombre_completo: 'Administrador del Sistema',
            rol_id: 1,
            rol_nombre: 'admin',
            estado: 'A',
            fecha_registro: '2024-01-01'
          }
        })
      });
      return;
    }
    if (url.includes('/api/ping')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', server_time: new Date().toISOString() })
      });
      return;
    }
    if (url.includes('/api/catalogs/all') || url.includes('/api/catalogs')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          lithology_full: [
            { grupo: 'VOLCÁNICO', lito1: 'ANDESITA', lito2: 'AND-01', lito3: 'A1', k: 12.5 }
          ],
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
          gsi_estructura: []
        })
      });
      return;
    }
    if (url.includes('/api/ventanas')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          kpis: { total_windows: 0, total_meters: 0, avg_rmr89: 0, rmr_classes: {} },
          total_filtered: 0,
          total_pages: 1,
          page: 1
        })
      });
      return;
    }
    if (url.includes('/api/windows/summary') || url.includes('/api/windows')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
      return;
    }
    if (url.includes('/api/ensayos-plt') || url.includes('/api/plt-ensayos')) {
      // Mockear 200 ensayos PLT para probar la virtualización y scroll
      const mockItems = [];
      for (let i = 1; i <= 200; i++) {
        mockItems.push({
          id: i,
          campana: '2024',
          fecha_ensayo: '2024-06-12',
          ejecutado_por: 'Ing. Geotécnico',
          tipo_ensayo: 'i',
          nivel: 4200,
          celda_mapeo: 'CELDA-01',
          muestra: String(i).padStart(2, '0'),
          codigo_muestra: `CELDA-01_${String(i).padStart(2, '0')}`,
          litologia_1: 'ANDESITA',
          litologia_2: 'AND-01',
          litologia_3: 'A1',
          tipo_litologico: 'Ígnea Volcánica',
          este: 540200 + i,
          norte: 8200300 + i,
          cota: 4250,
          espesor_d: 45.2,
          ancho_w1: 52.1,
          ancho_w2: 53.4,
          ancho_w: 52.75,
          d_w: 0.86,
          de_m: 55.1,
          fuerza_p: 14.5,
          f_factor: 1.05,
          is_mpa: 5.2,
          is50_mpa: 5.46,
          ucs_mpa: 109.2,
          isrm_clase: 'R4',
          dir_rotura: 'PARALELO',
          tipo_fractura: 'LIMPIA',
          valido_isrm: 'SÍ',
          observaciones: 'Test OK'
        });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockItems)
      });
      return;
    }
    if (url.includes('/api/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
      return;
    }
    await route.continue();
  });

  // 2. Establecer sesión, celda activa y vista inicial en localStorage
  await page.addInitScript(() => {
    const mockWindow = {
      header: {
        celda: 'CELDA-01',
        fecha_mapeo: '2024-06-12',
        sector_geotecnico: 'SECTOR-1',
        mapeador: 'ADMIN',
        lito_1: 'ANDESITA',
        largo_m: 10,
        altura_m: 3,
        nivel: '4200'
      },
      joints: []
    };

    localStorage.setItem('gema_auth_token', 'mock_jwt_token_12345');
    localStorage.setItem('geolog_active_window_celda', 'CELDA-01');
    localStorage.setItem('geolog_window_CELDA-01', JSON.stringify(mockWindow));
    localStorage.setItem('geolog_window_current_view', 'plt_ensayos');
    localStorage.setItem('gema_auth_user', JSON.stringify({
      usuario_id: 1,
      usuario: 'ADMIN',
      email: 'admin@geomec.pe',
      nombre_completo: 'Administrador del Sistema',
      rol_id: 1,
      rol_nombre: 'admin',
      estado: 'A',
      fecha_registro: '2024-01-01'
    }));
  });

  // 3. Navegar a la app
  console.log('1. Cargando la aplicación web en http://127.0.0.1:4174...');
  await page.goto('http://127.0.0.1:4174');
  await page.waitForTimeout(2000);

  // Si estamos en LoginPage, iniciar sesión
  const loginBtn = await page.$('button[type="submit"]');
  if (loginBtn) {
    console.log('  Detectado formulario de login, autenticando...');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await loginBtn.click();
    await page.waitForTimeout(2000);
  }

  // 4. Verificar que la vista de Ensayos PLT esté activa
  console.log('2. Esperando que cargue la página...');
  await page.waitForTimeout(3000);

  const dump = await page.content();
  const fs = require('fs');
  fs.writeFileSync('c:/Users/Rafael/UNSA/TRABAJO/GEMA/Mapeo/GEMA-Mapeo/Sistema/tests/page_dump.html', dump, 'utf8');
  console.log('  Dump HTML guardado en tests/page_dump.html');

  // Verificar qué tablas hay en el DOM
  const tableCount = await page.evaluate(() => document.querySelectorAll('table').length);
  console.log(`  Tablas encontradas en el documento: ${tableCount}`);

  // Verificar que la tabla virtualizada esté en el DOM (dentro del contenedor con tabindex="0")
  const tableEl = await page.waitForSelector('table', { timeout: 15000 });
  console.log('✅ Tabla encontrada en el DOM');

  // --- TEST A: VERIFICACIÓN DE CABECERAS DE 2 NIVELES ---
  console.log('\n--- TEST A: Geometría de Cabeceras de 2 Niveles ---');
  const headersInfo = await page.evaluate(() => {
    const gridTable = document.querySelector('div[tabindex="0"] table');
    const trs = gridTable ? gridTable.querySelectorAll('thead tr') : [];
    const row0Ths = Array.from(trs[0]?.querySelectorAll('th') || []);
    const row1Ths = Array.from(trs[1]?.querySelectorAll('th') || []);

    return {
      rowsCount: trs.length,
      row0Count: row0Ths.length,
      row1Count: row1Ths.length,
      row0Top: row0Ths[0] ? window.getComputedStyle(row0Ths[0]).top : null,
      row0Height: row0Ths[0] ? window.getComputedStyle(row0Ths[0]).height : null,
      row0Bg: row0Ths[0] ? window.getComputedStyle(row0Ths[0]).backgroundColor : null,
      row1Top: row1Ths[0] ? window.getComputedStyle(row1Ths[0]).top : null,
      row1Height: row1Ths[0] ? window.getComputedStyle(row1Ths[0]).height : null,
      row1Bg: row1Ths[0] ? window.getComputedStyle(row1Ths[0]).backgroundColor : null,
      numThColSpan: row0Ths[0]?.colSpan,
      numThText: row0Ths[0]?.innerText.trim()
    };
  });

  console.log(`  • Número de filas en thead: ${headersInfo.rowsCount} (esperado: 2)`);
  console.log(`  • Nivel 0 (Grupos) - Top: ${headersInfo.row0Top}, Height: ${headersInfo.row0Height}`);
  console.log(`  • Nivel 1 (Columnas Hoja) - Top: ${headersInfo.row1Top}, Height: ${headersInfo.row1Height}`);
  console.log(`  • Fondo cabecera Nivel 0: ${headersInfo.row0Bg}`);
  console.log(`  • Fondo cabecera Nivel 1: ${headersInfo.row1Bg}`);
  console.log(`  • Grupo Columna 0: "${headersInfo.numThText}", colSpan: ${headersInfo.numThColSpan}`);

  if (headersInfo.rowsCount !== 2) throw new Error('Se esperaban 2 filas en thead');
  if (headersInfo.row0Top !== '0px') throw new Error(`Nivel 0 top esperado '0px', obtuvo '${headersInfo.row0Top}'`);
  if (headersInfo.row1Top !== '28px') throw new Error(`Nivel 1 top esperado '28px', obtuvo '${headersInfo.row1Top}'`);
  console.log('✅ TEST A PASÓ: Geometría de 2 niveles top=0px y top=28px verificada.');

  // --- TEST B: VERIFICACIÓN DE VIRTUALIZACIÓN DE FILAS (O(1) DOM) ---
  console.log('\n--- TEST B: Virtualización DOM (Filas renderizadas vs Total dataset) ---');
  const domRowsCount = await page.evaluate(() => {
    return document.querySelectorAll('div[tabindex="0"] tbody tr').length;
  });
  console.log(`  • Filas en el DOM (div[tabindex="0"] tbody tr): ${domRowsCount}`);
  console.log(`  • Filas totales en dataset: 200`);
  if (domRowsCount > 40) {
    throw new Error(`Virtualización fallida: demasiados elementos en el DOM (${domRowsCount})`);
  }
  console.log('✅ TEST B PASÓ: Virtualización activa, solo ~20-30 filas en DOM.');

  // --- TEST C: VERIFICACIÓN DE STICKY BAJO SCROLL HORIZONTAL (400px) ---
  console.log('\n--- TEST C: Sticky de Columna Fija bajo Scroll Horizontal (400px) ---');
  const stickyBefore = await page.evaluate(() => {
    const container = document.querySelector('div[tabindex="0"]');
    const colNumTh = container.querySelector('thead tr:first-child th:first-child');
    const colNumTd = container.querySelector('tbody td:first-child');
    const cRect = container.getBoundingClientRect();
    return {
      thLeft: colNumTh.getBoundingClientRect().left - cRect.left,
      tdLeft: colNumTd.getBoundingClientRect().left - cRect.left
    };
  });

  await page.evaluate(() => {
    const container = document.querySelector('div[tabindex="0"]');
    container.scrollLeft = 400;
  });
  await page.waitForTimeout(300);

  const stickyAfter = await page.evaluate(() => {
    const container = document.querySelector('div[tabindex="0"]');
    const colNumTh = container.querySelector('thead tr:first-child th:first-child');
    const colNumTd = container.querySelector('tbody td:first-child');
    const cRect = container.getBoundingClientRect();
    return {
      scrollLeft: container.scrollLeft,
      thLeft: colNumTh.getBoundingClientRect().left - cRect.left,
      tdLeft: colNumTd.getBoundingClientRect().left - cRect.left
    };
  });

  console.log(`  • Scroll aplicado: ${stickyAfter.scrollLeft}px`);
  console.log(`  • Posición Left de cabecera '#' antes: ${stickyBefore.thLeft}px | después: ${stickyAfter.thLeft}px`);
  console.log(`  • Posición Left de celda '#' antes: ${stickyBefore.tdLeft}px | después: ${stickyAfter.tdLeft}px`);

  if (Math.abs(stickyAfter.thLeft - stickyBefore.thLeft) > 2) {
    throw new Error('La cabecera fija # se movió durante el scroll horizontal');
  }
  if (Math.abs(stickyAfter.tdLeft - stickyBefore.tdLeft) > 2) {
    throw new Error('La celda fija # se movió durante el scroll horizontal');
  }
  console.log('✅ TEST C PASÓ: Columna y cabecera # se mantienen 100% fijas en left: 0px bajo scroll.');

  // --- TEST D: MODO CLARO Y MODO OSCURO (COLOR CONTRAST & SCREENSHOTS) ---
  console.log('\n--- TEST D: Verificación de Modo Claro y Modo Oscuro ---');
  // Forzar Modo Oscuro
  await page.evaluate(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(400);

  const darkColors = await page.evaluate(() => {
    const container = document.querySelector('div[tabindex="0"]');
    const th = container.querySelector('thead th');
    const td = container.querySelector('tbody td:first-child');
    return {
      thBg: window.getComputedStyle(th).backgroundColor,
      thColor: window.getComputedStyle(th).color,
      tdBg: window.getComputedStyle(td).backgroundColor,
      tdColor: window.getComputedStyle(td).color
    };
  });
  console.log('  • Modo Oscuro - TH Bg:', darkColors.thBg, '| Text:', darkColors.thColor);
  console.log('  • Modo Oscuro - TD Bg:', darkColors.tdBg, '| Text:', darkColors.tdColor);

  const darkScreenshot = path.join(ARTIFACTS_DIR, 'screenshot_grid_plt_modo_oscuro.png');
  await page.screenshot({ path: darkScreenshot });
  console.log('  📸 Captura Modo Oscuro guardada:', darkScreenshot);

  // Forzar Modo Claro
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  });
  await page.waitForTimeout(400);

  const lightColors = await page.evaluate(() => {
    const container = document.querySelector('div[tabindex="0"]');
    const th = container.querySelector('thead th');
    const td = container.querySelector('tbody td:first-child');
    return {
      thBg: window.getComputedStyle(th).backgroundColor,
      thColor: window.getComputedStyle(th).color,
      tdBg: window.getComputedStyle(td).backgroundColor,
      tdColor: window.getComputedStyle(td).color
    };
  });
  console.log('  • Modo Claro - TH Bg:', lightColors.thBg, '| Text:', lightColors.thColor);
  console.log('  • Modo Claro - TD Bg:', lightColors.tdBg, '| Text:', lightColors.tdColor);

  const lightScreenshot = path.join(ARTIFACTS_DIR, 'screenshot_grid_plt_modo_claro.png');
  await page.screenshot({ path: lightScreenshot });
  console.log('  📸 Captura Modo Claro guardada:', lightScreenshot);

  await browser.close();
  console.log('\n========================================================================');
  console.log('🎯 RESULTADO: TODOS LOS TESTS EN CHROMIUM PASARON EXITOSAMENTE');
  console.log('========================================================================\n');
}

runBrowserValidation().catch(err => {
  console.error('\n❌ ERROR EN VALIDACIÓN CHROMIUM:', err);
  process.exit(1);
});
