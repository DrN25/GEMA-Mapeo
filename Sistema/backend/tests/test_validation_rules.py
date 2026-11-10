"""Mapping contract tests: pure modules only, no SQL/credentials/application startup."""
from copy import deepcopy
from types import SimpleNamespace
import json
import pytest
from app.validation.service import evaluate_window, evaluate_excel_extensions, catalog_data, INACTIVE, ALIASES
from app.validation.registry import RULES_REGISTRY
from app.validation.window_rules import WINDOW_RULES
from app.validation.adapters import from_save, from_import, header_row, joint_row
from app.validation.context import assert_valid, campaign_year
from app.validation.derived import effective_gsi
from app.core.catalogs import get_lithology_catalog_for_project


@pytest.fixture
def draft():
    lito=get_lithology_catalog_for_project('ferrobamba')[0]
    return {'header':dict(celda='TEST-001',campania=7,fecha='2026-01-02',nivel='4000',fase='1',
        este_from=791000,norte_from=8420000,cota_from=4000,este_to=791010.49,norte_to=8420000,cota_to=4000,
        largo=10.49,altura=2,dip_talud=60,dip_hw=0,az_hw=90,dipdir_talud=180,
        lito_1=lito['lito1'],lito_2=lito['lito2'],lito_3=lito['lito3'],unidad_litologica=lito['grupo'],
        sect_geot='TEST',intemperia='f',mapeador='TEST',condicion_agua='C',resistencia_ucs='R4',
        gsi_estructura='B',gsi_superficie='VG',gsi_visual=0,control_estructural=1,efectos_voladura=1),
        'joints':[dict(id=42,familia=1,distancia=1,dip=30,dip_dir=20,tipo_estructura='JN',n_estructuras=1,
            abertura=0,espesor=0,continuidad=.5,espaciamiento=1,extremos_visibles=1,terminacion=1,
            relleno1='c',relleno2='-1',jrc=0,rugosidad=9,forma='P',alteracion='f')]}


def codes(result):return {i['rule_id'] for i in result['issues']}


def test_valid_draft_and_same_authority_at_save(draft):
    a=evaluate_window(draft,campaign_year=2026)
    b=evaluate_window(draft,operation='window_save',campaign_year=2026)
    assert a['can_save'],a['issues']
    assert a['issues']==b['issues']
    assert a['derived']==b['derived']
    assert a['derived']['gsi_visual']==85


@pytest.mark.parametrize('field,value,expected',[
 ('dip',-10,'ERR_DIP_ESTRUC_RANGO'),('dip',90.01,'ERR_DIP_ESTRUC_RANGO'),
 ('dip',2.5,'DIP_ESTRUCTURA_ENTERO'),('dip_dir',360,'DIP_DIR_RANGO'),
 ('dip_dir',12.5,'DIP_DIR_ENTERO'),('n_estructuras',0,'N_ESTRUCTURAS_CERO'),
 ('n_estructuras',-2,'N_ESTRUCTURAS_NEGATIVO'),('n_estructuras',1.5,'ERR_NUMERO_ESTRUCTURAS_DECIMAL'),
 ('distancia',0,'DISTANCIA_CERO'),('distancia',-2,'ERR_DISTANCIA_ESTRUCTURA_EXCEDE_CELDA'),
 ('jrc',21,'ERR_JRC_RANGO'),('jrc',2.8,'JRC_ENTERO'),('rugosidad',10,'ERR_RUGOSIDAD_RANGO'),
 ('rugosidad',2.8,'RUGOSIDAD_ENTERO'),('abertura',-2,'ERR_ABERTURA_NEGATIVO'),
 ('espesor',-2,'ERR_ESPESOR_NEGATIVO'),('continuidad',-2,'ERR_CONTINUIDAD_NEGATIVA'),
 ('espaciamiento',12,'ESPACIAMIENTO_EXCEDE_LARGO'),('espaciamiento',-2,'ERR_ESPACIAMIENTO_NEGATIVO'),
])
def test_joint_boundaries(draft,field,value,expected):
    draft['joints'][0][field]=value
    result=evaluate_window(draft)
    assert expected in codes(result)
    assert not result['can_save']
    issue=next(i for i in result['issues'] if i['rule_id']==expected)
    assert issue['entity_id']==42
    assert issue['fieldId'].endswith('-0')


@pytest.mark.parametrize('distance,invalid',[(10.4,False),(10.52,False),(10.521,True)])
def test_decimal_length_and_tolerance(draft,distance,invalid):
    draft['joints'][0]['distancia']=distance
    assert ('ERR_DISTANCIA_ESTRUCTURA_EXCEDE_CELDA' in codes(evaluate_window(draft))) is invalid


@pytest.mark.parametrize('value',[None,'',-1,'-1','   '])
def test_required_values(draft,value):
    draft['header']['altura']=value
    result=evaluate_window(draft)
    assert any(i['rule_id']=='ERR_CAMPO_OBLIGATORIO_VACIO' and i['fieldId']=='header-altura' for i in result['issues'])


@pytest.mark.parametrize('value',['abc','Infinity',float('inf'),{'bad':1}])
def test_invalid_numbers_are_not_zero_or_success(draft,value):
    draft['header']['control_estructural']=value
    result=evaluate_window(draft)
    assert 'ERR_VALOR_NUMERICO_INVALIDO' in codes(result)
    assert not result['can_save']


def test_warning_never_blocks(draft):
    draft['header']['altura']=31
    result=evaluate_window(draft)
    assert 'ALTURA_MAXIMA' in codes(result)
    assert result['can_save']


def test_clean_is_not_missing_and_cwf_is_clean(draft):
    draft['joints'][0].update(abertura=2,espesor=1,relleno1='cwf')
    assert 'ESPESOR_NO_CERO_RELLENO_LIMPIO' in codes(evaluate_window(draft))
    draft['joints'][0]['relleno1']=None
    result=evaluate_window(draft)
    assert 'ESPESOR_NO_CERO_RELLENO_LIMPIO' not in codes(result)
    assert 'ERR_CAMPO_OBLIGATORIO_VACIO' in codes(result)


def test_vacant_and_partial_rows(draft):
    draft['joints'].append({'id':43,'familia':2,'alteracion':'f'})
    assert not any(i['row_index']==1 for i in evaluate_window(draft)['issues'])
    draft['joints'][1]['dip']=20
    assert any(i['row_index']==1 and i['severity']=='VACIO' for i in evaluate_window(draft)['issues'])


@pytest.mark.parametrize('raw',[-50,2.5,'stale'])
def test_effective_gsi_not_stale_header(draft,raw):
    draft['header']['gsi_visual']=raw
    result=evaluate_window(draft)
    assert 'GSI_VISUAL_NEGATIVO' not in codes(result)
    assert result['can_save'],result['issues']
    draft['header']['gsi_estructura']='D';draft['header']['gsi_superficie']='VP'
    assert 'GSI_VISUAL_RANGO' in codes(evaluate_window(draft))


def test_catalog_completeness_and_inactive():
    catalog=catalog_data()
    assert len({r['id'] for r in catalog['rules']})==len(catalog['rules'])
    assert all(not r['enabled'] for r in catalog['rules'] if r['id'] in INACTIVE)
    assert set(ALIASES.values()) <= RULES_REGISTRY.keys()
    assert {r.code for r in WINDOW_RULES} <= RULES_REGISTRY.keys()
    assert all(r['scope'] and r['views'] and r['operations'] for r in catalog['rules'])


def test_every_active_rule_has_a_concrete_emission_site():
    import ast
    from pathlib import Path
    root=Path(__file__).parents[1]/'app/validation'
    emitted={r.code for r in WINDOW_RULES}
    for name in ('predicates.py','excel.py','service.py'):
        for node in ast.walk(ast.parse((root/name).read_text(encoding='utf-8'))):
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Name):
                idx=2 if node.func.id=='registrar_error' else 0 if node.func.id=='emit' else None
                if idx is not None and len(node.args)>idx and isinstance(node.args[idx],ast.Constant):
                    emitted.add(node.args[idx].value)
            if isinstance(node,ast.Dict):
                for key,value in zip(node.keys,node.values):
                    if isinstance(key,ast.Constant) and key.value=='rule_code' and isinstance(value,ast.Constant):emitted.add(value.value)
    assert {code for code,rule in RULES_REGISTRY.items() if rule.enabled} <= emitted


def test_enabled_and_scope_control_real_execution(draft,monkeypatch):
    draft['header']['largo']=0
    rule=RULES_REGISTRY['LARGO_CERO']
    monkeypatch.setattr(rule,'scope',('frontend',))
    assert 'LARGO_CERO' in codes(evaluate_window(draft))
    assert 'LARGO_CERO' not in codes(evaluate_window(draft,operation='window_save'))
    monkeypatch.setattr(rule,'enabled',False)
    assert 'LARGO_CERO' not in codes(evaluate_window(draft))


def test_readonly_geometry_uses_effective_values(draft):
    draft['header'].update(dip_hw=None,az_hw=None,dipdir_talud=999)
    draft['header'].pop('largo')
    result=evaluate_window(draft)
    assert result['can_save'],result['issues']
    assert result['derived']['geometry']['length_m']==pytest.approx(10.49)
    assert result['derived']['geometry']['az_hw']==90
    assert result['derived']['geometry']['dipdir_talud']==180


def test_textual_level_not_rejected_as_numeric_type(draft):
    draft['header']['nivel']='NV_200'
    assert 'ERR_VALOR_NUMERICO_INVALIDO' not in codes(evaluate_window(draft))


def test_extension_parity_excel_and_preview(draft):
    draft['header']['altura']=31
    draft['header']['gsi_visual']=85  # Excel reports this value; preview derives the same value.
    draft['joints'][0]['dip_dir']=360
    calls=[]
    row={**header_row(draft['header']),**joint_row(draft['joints'][0])}
    evaluate_excel_extensions(row,10.49,lambda col,val,code,**kw:calls.append(code),campaign_year=2026)
    assert {'ALTURA_MAXIMA','DIP_DIR_RANGO'} <= set(calls)
    assert set(calls) <= codes(evaluate_window(draft,campaign_year=2026))


def test_campaign_identity():
    assert campaign_year(3)==2022
    assert campaign_year(2021)==2021
    assert campaign_year(999) is None


@pytest.mark.parametrize('alias',['campana','campana_id','campania_id'])
def test_existing_header_aliases_are_preserved(draft,alias):
    draft['header'][alias]=draft['header'].pop('campania')
    draft['header']['sector']=draft['header'].pop('sect_geot')
    draft['header']['geologo']=draft['header'].pop('mapeador')
    result=evaluate_window(draft)
    assert result['can_save'],result['issues']


def test_guards_raise_structured_error(draft):
    from fastapi import HTTPException
    draft['header']['altura']=0
    with pytest.raises(HTTPException) as error:assert_valid(evaluate_window(draft,operation='window_save'))
    assert error.value.status_code==422
    assert error.value.detail['code']=='VALIDATION_FAILED'


def test_save_payload_aliases_keep_the_validated_values(draft):
    from app.schemas import VentanaSaveSchema
    h=draft['header'];j=draft['joints'][0]
    payload={**{k:h[k] for k in ('campania','nivel','fase','lito_1','lito_2','lito_3','unidad_litologica','mapeador','dip_talud','dipdir_talud')},
        'codigo':h['celda'],'fecha_mapeo':h['fecha'],'largo_m':h['largo'],'altura':h['altura'],
        'sector_geotecnico':h['sect_geot'],'intemperismo':h['intemperia'],
        'dip_hw':h['dip_hw'],'az_hw':h['az_hw'],
        **{s+'_'+target:h[s+'_'+source] for s in ('este','norte','cota') for target,source in (('ini','from'),('fin','to'))},
        'rmr_input':{**h,'agua_codigo':h['condicion_agua'],'resistencia_codigo':h['resistencia_ucs']},
        'discontinuidades':[dict(fam=j['familia'],dist=j['distancia'],tipo=j['tipo_estructura'],dip=j['dip'],dipdir=j['dip_dir'],
            aber=j['abertura'],esp=j['espesor'],cont=j['continuidad'],espac=j['espaciamiento'],nstr=j['n_estructuras'],
            next=j['extremos_visibles'],term=j['terminacion'],r1=j['relleno1'],r2=j['relleno2'],jrc=j['jrc'],rug=j['rugosidad'],forma=j['forma'],alt=j['alteracion'])]}
    schema=VentanaSaveSchema(**payload)
    assert schema.distancia_celda==10.49
    adapted=from_save(schema)
    result=evaluate_window(adapted,operation='window_save',campaign_year=2026)
    assert result['can_save'],result['issues']
    assert result['derived']==evaluate_window(draft,campaign_year=2026)['derived']


def test_import_adapts_actual_structures_argument(draft):
    h=draft['header'];j=draft['joints'][0]
    excel={**h,'largo_m':h['largo'],'altura_m':h['altura'],'fecha':h['fecha'],'sector':h['sect_geot'],
        'intemperismo':h['intemperia'],'condicion_agua_rmr89':'C','dureza_rmr89':'R4',
        **{s+'_'+target:h[s+'_'+source] for s in ('este','norte','cota') for target,source in (('ini','from'),('fin','to'))}}
    structure={'familia_id':1,'distancia_m':1,'tipo_estructura':'JN','dip':30,'dip_dir':20,
        'abertura_mm':0,'espesor_mm':0,'continuidad_m':.5,'espaciamiento_m':1,'n_estructuras':1,
        'n_extremos_visibles':1,'terminacion':1,'relleno_1_codigo':'c','relleno_2_codigo':'-1','jrc':0,
        'rugosidad_codigo':9,'forma_estructura':'P','alteracion_codigo':'f'}
    adapted=from_import(SimpleNamespace(excel_data=excel,codigo_final='IMPORTED',estructuras=[structure]))
    result=evaluate_window(adapted,operation='import_save',campaign_year=2026)
    assert result['can_save'],result['issues']
    assert result['client_id']=='IMPORTED'
    assert adapted['joints'][0]['distancia']==1


def test_excel_writes_version_and_preserves_raw(tmp_path):
    import pandas as pd
    from app.utils.validator import validate_bulk_excel
    input=tmp_path/'input.xlsx';output=tmp_path/'diagnostic.json'
    pd.DataFrame([{'CELDA':'TEST','Campaña':2026,'Altura':-2,'TIPO':'-1'}]).to_excel(input,index=False)
    validate_bulk_excel(str(input),str(output))
    diag=json.loads(output.read_text(encoding='utf-8'))
    assert diag['ruleset_version'].startswith('mapeo-v1.')
    assert any(i['rule_code']=='ALTURA_NEGATIVA' for i in diag['incidencias'])
