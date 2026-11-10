/** Offline contract/race tests: no HTTP, SQL or running app required. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, '../frontend');
const cache = path.join(here, '.cache/validation');
mkdirSync(cache, { recursive: true });
execFileSync(process.execPath, [path.join(frontend, 'node_modules/typescript/bin/tsc'),
  'src/services/validationApi.ts', 'src/hooks/useWindowValidation.ts', 'src/utils/rmrCalculator.ts', 'src/utils/mandatoryRules.ts',
  '--module', 'commonjs', '--outDir', cache, '--target', 'es2022', '--skipLibCheck',
  '--esModuleInterop', '--ignoreConfig', '--types', 'react'], { cwd: frontend, stdio: 'inherit' });
const require = createRequire(import.meta.url);
const { validateWindows, validationErrorMessage } = require(path.join(cache, 'services/validationApi.js'));
globalThis.localStorage = { getItem: () => 'test-token' };

test('preview sends auth and correlates the exact request', async () => {
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.ok(url.endsWith('/api/validation/windows/preview'));
    return { ok: true, status: 200, json: async () => ({ ...body, ruleset_version: 'v1', windows: [{ client_id: 'A', can_save: true, issues: [], ruleset_version: 'v1' }] }) };
  };
  assert.equal((await validateWindows('', [{ header: { celda: 'A' }, joints: [] }])).windows[0].can_save, true);
});

test('wrong revision and HTTP failures never approve a draft', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ request_id: 'old', windows: [{}] }) });
  await assert.rejects(validateWindows('', [{ header: {}, joints: [] }]));
  globalThis.fetch = async () => ({ ok: false, status: 422 });
  await assert.rejects(validateWindows('', [{ header: {}, joints: [] }]), /HTTP 422/);
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(validateWindows('', [{ header: {}, joints: [] }]), /offline/);
});

test('structured save errors remain readable', () => {
  assert.equal(validationErrorMessage({ issues: [{ message: 'Campo requerido' }] }, 'fallback'), 'Campo requerido');
  assert.equal(validationErrorMessage('Error anterior', 'fallback'), 'Error anterior');
  assert.equal(validationErrorMessage([{ msg: 'schema' }], 'fallback'), 'fallback');
});

test('PLT required fields and severity policy remain independent', () => {
  const plt = require(path.join(cache, 'utils/mandatoryRules.js'));
  assert.equal(plt.validatePltEnsayosList([]).length, 0);
  assert.equal(plt.validatePltEnsayosList([{}]).length, 10);
  assert.equal(plt.isBlockingValidationAlert('ADVERTENCIA'), false);
  assert.equal(plt.isBlockingValidationAlert('VACIO'), true);
});

function hookHarness() {
  let state = { key: '' }, effect, timer, cleanup;
  const requests = [];
  const module = { exports: {} };
  const react = {
    useState: () => [state, value => { state = value; }],
    useEffect: fn => { effect = fn; },
  };
  vm.runInNewContext(readFileSync(path.join(cache, 'hooks/useWindowValidation.js'), 'utf8'), {
    module, exports: module.exports, AbortController, Error,
    setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => {},
    require: name => name === 'react' ? react : { validateWindows: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) },
  });
  return {
    render: draft => module.exports.useWindowValidation('', draft, true),
    dispatch: () => { cleanup?.(); cleanup = effect(); timer(); }, requests,
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('late response cannot replace the current draft or approve an edited one', async () => {
  const h = hookHarness();
  const a = { header: { celda: 'A' }, joints: [] }, b = { header: { celda: 'B' }, joints: [] };
  assert.equal(h.render(a).pending, true); h.dispatch();
  assert.equal(h.render(b).pending, true); h.dispatch();
  h.requests[1].resolve({ windows: [{ client_id: 'B', can_save: true }] }); await flush();
  assert.equal(h.render(b).result.client_id, 'B');
  h.requests[0].resolve({ windows: [{ client_id: 'A', can_save: true }] }); await flush();
  assert.equal(h.render(b).result.client_id, 'B');
  assert.equal(h.render({ ...b, header: { celda: 'B', altura: 0 } }).result, undefined);
});

test('offline hook retains no stale approval', async () => {
  const h = hookHarness(), draft = { header: { celda: 'A' }, joints: [] };
  h.render(draft); h.dispatch(); h.requests[0].reject(new Error('offline')); await flush();
  assert.equal(h.render(draft).result, undefined);
  assert.equal(h.render(draft).error, 'offline');
});

test('Python GSI subgraph matches the editor across mixed families and materials', () => {
  const python = path.resolve(here, '../backend/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const code = `
import json, random
from app.core import catalogs as c
from app.validation.derived import effective_gsi
from app.validation.context import CAMPAIGNS
random.seed(27)
fixtures=[]
for size in [0,1,2,4,9,20,50]:
 for trial in range(10):
  rows=[]
  for i in range(size):
   rows.append(dict(id=i,familia=random.randint(1,9),n_estructuras=random.choice([-1,1,2,5]),espaciamiento=random.choice([-1,0,.01,.3,1,2]),continuidad=random.choice([-1,0,.5,2,5,15,25]),abertura=random.choice([-1,0,.05,.1,.9,1,5]),espesor=random.choice([-1,0,1,5,10]),alteracion=random.choice(['f','d','m','s','-1']),rugosidad=random.randint(1,9),relleno1=random.choice(['c','si','cl','-1']),relleno2=random.choice(['-1',None,'c','cl'])))
  fixtures.append(dict(rows=rows,expected=effective_gsi(rows)))
catalog=dict(campaigns=[dict(id=id,label=f'Campaña {year}') for id,year in CAMPAIGNS],lithology_full=[],agua=[],resistencia=[],estructura=[],forma=[],relleno=c.RELLENO_DISPLAY_CATALOG,alteracion=c.ALTERACION_DISPLAY_CATALOG,rugosidad=c.RUGOSIDAD_DISPLAY_CATALOG)
print(json.dumps(dict(fixtures=fixtures,catalog=catalog)))
`;
  const data = JSON.parse(execFileSync(python, ['-c', code], { cwd: path.resolve(here, '../backend'), encoding: 'utf8' }));
  require(path.join(cache, 'utils/catalogData.js')).initCatalogs(data.catalog);
  const campaigns = require(path.join(cache, 'utils/campaniasCatalog.js'));
  assert.equal(campaigns.getCampaniaIdFromYear(2022), 3);
  assert.equal(campaigns.getCampaniaYear(3), 2022);
  const calc = require(path.join(cache, 'utils/rmrCalculator.js'));
  for (const [index, fixture] of data.fixtures.entries()) {
    const value = calc.calculateWindowGeomec({ celda: 'TEST', largo: 20 }, fixture.rows);
    assert.equal(value.rqd_est, fixture.expected.rqd_est, `RQD fixture ${index}`);
    assert.equal(value.condicion_rating_89, fixture.expected.condicion_rating_89, `JCond fixture ${index}`);
    assert.equal(calc.suggestGsiVisual(value.rqd_est, value.condicion_rating_89), fixture.expected.gsi_visual, `GSI fixture ${index}`);
  }
});
