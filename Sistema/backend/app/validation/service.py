"""Shared mapping validation service. This module has no database dependency."""
import hashlib
from pathlib import Path
from functools import lru_cache
from . import registry
from .fields import REQUIRED, LABELS
from .normalization import blank, number, first
from .adapters import HEADER_COLUMNS, JOINT_COLUMNS, header_row, joint_row
from .predicates import validate_geotechnical_header, validate_geomechanical_properties, validate_lithology_correlation, validate_structural_row
from .window_rules import WINDOW_RULES, JOINT_FIELDS
from .derived import effective_gsi, geometry

INACTIVE = registry.INACTIVE
ALIASES = registry.ALIASES

@lru_cache(maxsize=1)
def ruleset_version():
    # Includes conditions, normalization, adapters, derived inputs and static catalogs.
    paths = sorted(Path(__file__).parent.glob('*.py')) + [Path(__file__).parents[1]/'core/catalogs.py',Path(__file__).parents[1]/'utils/interpolation.py']
    digest=hashlib.sha256()
    for path in paths:
        digest.update(path.name.encode())
        digest.update(path.read_text(encoding='utf-8-sig').encode('utf-8'))
    return 'mapeo-v1.'+digest.hexdigest()[:16]


def section(field):
    return 'ANÁLISIS RMR & GSI' if field in REQUIRED['rmrGsi'] or field in ('gsi_visual','ucs_mpa','is50_mpa') else 'DATOS DE REGISTRO'


def evaluate_window(window, *, operation='window_preview', project='ferrobamba', campaign_year=None):
    if operation not in ('window_preview','window_save','import_save'):
        raise ValueError('Unsupported window validation operation')
    header=dict(window.get('header') or {})
    header['campania']=first(header,'campania','campana','campana_id','campania_id')
    header['campana']=header['campania']
    header['sect_geot']=first(header,'sect_geot','sector','sector_geotecnico')
    header['mapeador']=first(header,'mapeador','geologo','ejecutado_por')
    if campaign_year is None:
        from .context import campaign_year as resolve_year
        campaign_year=resolve_year(header['campania'])
    # The current editor uses HOLE_AUTO=true: validate and persist the effective
    # read-only orientation, not a stale/imported header that cannot be edited.
    effective_geometry=geometry(header)
    if effective_geometry:
        header.update({k:effective_geometry[k] for k in ('dip_hw','az_hw','dipdir_talud')})
        if blank(header.get('largo')):header['largo']=effective_geometry['length_m']
    joints=window.get('joints') or []
    issues=[];seen=set();evaluated=set()
    def emit(code,field,message,severity='CRITICA',idx=None,value=None):
        spec=registry.RULES_REGISTRY[code]
        target='frontend' if operation=='window_preview' else 'backend'
        if not spec.enabled or target not in spec.scope or operation not in spec.operations:return
        key=(code,field,idx)
        if key in seen:return
        seen.add(key)
        entity_id=joints[idx].get('id',idx) if idx is not None else 'header'
        issues.append({'issue_id':f'{code}:{entity_id}:{field}','rule_id':code,'ruleId':code,
            'severity':severity,'type':severity,'blocking':severity in ('CRITICA','VACIO'),
            'fieldId':f'joint-{field}-{idx}' if idx is not None else f'header-{"campania" if field == "campana" else field}',
            'path':f'joints[{entity_id}].{field}' if idx is not None else f'header.{field}',
            'entity_id':entity_id,'row_index':idx,'section':'DISCONTINUIDADES' if idx is not None else section(field),
            'message':message,'observed_value':value})
    for group in ('header','rmrGsi'):
        for key in REQUIRED[group]:
            if blank(header.get(key)):emit('ERR_CAMPO_OBLIGATORIO_VACIO',key,f"El campo '{LABELS.get(key,key)}' es obligatorio.",'VACIO')
    numeric_header=('este_from','norte_from','cota_from','este_to','norte_to','cota_to','largo','altura','dip_talud','dipdir_talud','dip_hw','az_hw','fase','ucs_mpa','is50_mpa','control_estructural','efectos_voladura')
    def types(row,fields,idx=None):
        for key in fields:
            if not blank(row.get(key)) and number(row.get(key)) is None:
                emit('ERR_VALOR_NUMERICO_INVALIDO',key,f"'{LABELS.get(key,key)}' debe ser un número finito.",idx=idx,value=str(row.get(key)))
    types(header,numeric_header)
    for key in numeric_header:
        if not blank(header.get(key)):
            header[key]=number(header[key],sentinel=False)
    length=number(header.get('largo'))
    coords=[number(header.get(stem+'_'+end),sentinel=False) for end in ('from','to') for stem in ('este','norte','cota')]
    if all(x is not None for x in coords):
        import math
        norm=math.dist(coords[:3],coords[3:])
        if norm < registry.GEOMECHANICAL_THRESHOLDS['MIN_SEGMENT_LENGTH']:
            emit('GEOM_ERR_SEGMENTO_DEGENERADO','este_to','La longitud física de la celda debe ser al menos 0.01 m.')
    def callback(idx=None):
        mapping=JOINT_COLUMNS if idx is not None else HEADER_COLUMNS
        reverse={v:k for k,v in mapping.items()}
        def register(col,val,code,**kwargs):
            rule=registry.RULES_REGISTRY[code];category=registry.CATEGORIES_REGISTRY[rule.category_code]
            field=reverse.get(col)
            if field is None:
                field='condicion_agua' if 'AGUA' in col else 'resistencia_ucs' if 'DUREZA' in col else 'control_estructural' if 'CONTROL' in col else 'efectos_voladura' if 'VOLADURA' in col else 'celda'
            severity='CRITICA' if category.severity=='ALERTA' else category.severity
            # User-facing observation, never admin-only recommendations.
            emit(code,field,rule.format_message(es_admin=False,**kwargs),severity,idx,val)
            evaluated.add(code)
        return register
    hr=header_row(header)
    validate_geotechnical_header(hr,callback())
    validate_geomechanical_properties(hr,callback(),campaign_year)
    validate_lithology_correlation(hr,callback(),project=project)
    active_indices=set()
    for idx,row in enumerate(joints):
        # Same vacant-row policy as the previous required-field evaluator.
        vacant=all(blank(row.get(k)) for k in REQUIRED['discontinuities'] if k not in ('familia','alteracion')) and blank(row.get('relleno2'))
        if vacant:continue
        active_indices.add(idx)
        for key in REQUIRED['discontinuities']:
            if blank(row.get(key)):emit('ERR_CAMPO_OBLIGATORIO_VACIO',key,f"El campo '{LABELS.get(key,key)}' es obligatorio.",'VACIO',idx)
        types(row,('familia','distancia','dip','dip_dir','n_estructuras','abertura','espesor','continuidad','espaciamiento','extremos_visibles','terminacion','jrc','rugosidad'),idx)
        row = {**row, **{k:number(row[k],sentinel=False) for k in ('distancia','dip','dip_dir','n_estructuras','abertura','espesor','continuidad','espaciamiento','jrc','rugosidad') if not blank(row.get(k))}}
        # Original values already have type diagnostics; retain legacy numerical semantics.
        validate_structural_row(joint_row(row),length,callback(idx))
    derived=effective_gsi(joints)
    derived['geometry']=effective_geometry
    effective_header={**header,'gsi_visual':derived['gsi_visual']}
    for rule in WINDOW_RULES:
        target='frontend' if operation=='window_preview' else 'backend'
        if not registry.RULES_REGISTRY[rule.code].enabled or target not in registry.RULES_REGISTRY[rule.code].scope or operation not in registry.RULES_REGISTRY[rule.code].operations:
            continue
        evaluated.add(rule.code)
        rows=enumerate(joints) if rule.field in JOINT_FIELDS else [(None,effective_header)]
        for idx,row in rows:
            if idx is not None and idx not in active_indices:continue
            if rule.fails(row,header,length,campaign_year,derived['gsi_visual']):
                emit(rule.code,rule.field,rule.message,rule.severity,idx,row.get(rule.field))
    return {'client_id':header.get('celda'),'can_save':not any(i['blocking'] for i in issues),
            'issues':issues,'derived':derived,'ruleset_version':ruleset_version(),
            'counts':{k:sum(i['severity']==k for i in issues) for k in ('CRITICA','ADVERTENCIA','VACIO')},
            'coverage':{'evaluated_extension_rule_ids':sorted(evaluated),'context':operation}}


_NUMERIC_HEADER_KEYS = (
    'largo', 'altura', 'este_from', 'norte_from', 'cota_from', 'este_to', 'norte_to', 'cota_to',
    'dip_talud', 'dip_hw', 'az_hw', 'dipdir_talud', 'ucs_mpa', 'is50_mpa', 'gsi_visual',
)
_NUMERIC_JOINT_KEYS = tuple(JOINT_FIELDS)
_EXCEL_RULE_SPECS = tuple(
    (
        rule,
        rule.field in JOINT_FIELDS,
        (JOINT_COLUMNS if rule.field in JOINT_FIELDS else HEADER_COLUMNS).get(rule.field, rule.field),
        registry.RULES_REGISTRY[rule.code],
    )
    for rule in WINDOW_RULES
)
_NO_VALUE_REQUIRED_KINDS = frozenset({'campaign_date', 'gsi_range'})


def evaluate_excel_extensions(
    row,
    length,
    register,
    *,
    campaign_year=None,
    is_parent=True,
    header_keys=None,
    joint_keys=None,
):
    """Same extension predicates, without imposing form-only required fields on Excel."""
    from .adapters import from_excel
    from .normalization import number, blank

    window = from_excel(
        row,
        length,
        header_keys=header_keys,
        joint_keys=joint_keys,
        include_header=is_parent,
    )
    header = window['header']
    joint = window['joints'][0]

    if is_parent:
        for key in _NUMERIC_HEADER_KEYS:
            raw = header.get(key)
            if raw is not None and not blank(raw) and number(raw) is None:
                register(HEADER_COLUMNS.get(key, key), raw, 'ERR_VALOR_NUMERICO_INVALIDO')

    for key in _NUMERIC_JOINT_KEYS:
        raw = joint.get(key)
        if raw is not None and not blank(raw) and number(raw) is None:
            register(JOINT_COLUMNS.get(key, key), raw, 'ERR_VALOR_NUMERICO_INVALIDO')

    is_tipo_sin_reg = str(joint.get('tipo_estructura')).strip() in ('-1', '-1.0')
    length_num = number(length)
    gsi_num = number(header.get('gsi_visual')) if is_parent else None

    for rule, is_joint, canonical_col, reg_rule in _EXCEL_RULE_SPECS:
        if not reg_rule.enabled or 'backend' not in reg_rule.scope or 'excel_review' not in reg_rule.operations:
            continue
        if is_joint:
            if is_tipo_sin_reg:
                continue
            data = joint
        else:
            if not is_parent:
                continue
            data = header

        raw_val = data.get(rule.field)
        if raw_val is None and rule.kind not in _NO_VALUE_REQUIRED_KINDS:
            continue
        # No synthetic GSI from one row: review compares the reported value.
        if rule.fails(data, header, length_num, campaign_year, gsi_num):
            register(canonical_col, raw_val, rule.code)


def catalog_data():
    legacy=registry.get_rules_catalog_data()
    extension={r.code:r for r in WINDOW_RULES}
    result=[]
    for item in legacy:
        code=item['code'];ext=extension.get(code);spec=registry.RULES_REGISTRY[code]
        active=spec.enabled
        result.append({**item,'id':code,'severity':'CRITICA' if item['severity']=='ALERTA' else item['severity'],
            'enabled':active,'status':'documented_only' if code in INACTIVE else 'active' if active else 'disabled',
            'scope':list(spec.scope),
            'views':list(spec.views),
            'operations':list(spec.operations),
            'module':'DISCONTINUIDADES' if ext and ext.field in JOINT_FIELDS else item['tipo_mapeo'],
            'fields':item['columns'],'parameters':ext.parameters if ext else {},'legacy_ids':[a for a,b in ALIASES.items() if b==code]})
    return {'schema_version':'1','ruleset_version':ruleset_version(),'required_fields':REQUIRED,'field_labels':LABELS,'rules':result}
