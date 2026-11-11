"""Boundary adapters. No defaults that erase invalid observations."""
from .normalization import first

HEADER_COLUMNS = {
    'celda':'CELDA_PADRE', 'largo':'Dist.Celda', 'altura':'Altura',
    'este_from':'ESTE_FROM','norte_from':'NORTE_FROM','cota_from':'COTA_FROM',
    'este_to':'ESTE_TO','norte_to':'NORTE_TO','cota_to':'COTA_TO',
    'dip_talud':'DIP_TALUD','dip_hw':'DIP','az_hw':'AZ_HOLE','dipdir_talud':'DIP_DIR_TALUD',
    'lito_1':'Lito 1','lito_2':'Lito 2','lito_3':'Lito 3','unidad_litologica':'Unidad Litologica',
    'fase':'Fase','nivel':'Nivel','fecha':'FECHA','campania':'Campaña','mapeador':'GEOTECNICO',
    'sect_geot':'sector_geotecnico','intemperia':'INTEMPERISMO',
    'ucs_mpa':'( UCS )  (Mpa)','is50_mpa':'is50 (Mpa)',
    'gsi_visual':"GSI VISUAL '89", 'gsi_estructura':'GSI_ESTRUCTURA','gsi_superficie':'GSI_SUPERFICIE',
}
JOINT_COLUMNS = {
    'tipo_estructura':'TIPO','distancia':'Dist. de estr.','dip':'DIP_ESTRUC','dip_dir':'DIP DIR',
    'n_estructuras':'NUMERO DE ESTRUCTURAS','abertura':'ABERTURA mm.','espesor':'ESPESOR mm.',
    'continuidad':'CONTINUIDAD m.','espaciamiento':'ESPACIAMIENTO m.',
    'relleno1':'TIPO DE  RELLENO 1','relleno2':'TIPO DE  RELLENO 2',
    'jrc':'JRC','rugosidad':'RUGOSIDAD DE ESTRUCTURAS','forma':'FORMA DE ESTRUCTURA','alteracion':'ALTERACION',
    'x':'x','y':'y','z':'z',
}


def header_row(header):
    row = {col: header.get(key) for key,col in HEADER_COLUMNS.items()}
    for suffix in ('76','89'):
        row[f"CONDICION DE AGUA  '{suffix}" + ('.' if suffix=='76' else '')] = header.get('condicion_agua')
        row[f"DUREZA  '{suffix}"] = header.get('resistencia_ucs')
        row[f"CONTROL ESTRUCTURAL  '{suffix}"] = header.get('control_estructural')
        row[f"EFECTOS DE VOLADURA  '{suffix}"] = header.get('efectos_voladura')
    return row


def joint_row(row):
    return {col:row.get(key) for key,col in JOINT_COLUMNS.items()}


def from_save(data):
    data = data.model_dump() if hasattr(data, 'model_dump') else dict(data)
    rmr = data.get('rmr_input') or {}
    h = {key: data.get(key) for key in ('nivel','fase','lito_1','lito_2','lito_3','unidad_litologica','mapeador','dip_talud','dipdir_talud')}
    h.update(celda=data.get('codigo'), fecha=str(data.get('fecha_mapeo') or ''), campania=data.get('campania'),
             largo=first(data,'distancia_celda','largo_m'), altura=first(data,'altura','altura_m'),
             dip_hw=first(data,'dip','dip_hw'), az_hw=first(data,'azimut_hole','az_hw'),
             sect_geot=data.get('sector_geotecnico'), intemperia=first(data,'intemperismo','intemperismo_codigo'),
             condicion_agua=rmr.get('agua_codigo'), resistencia_ucs=rmr.get('resistencia_codigo'))
    for key in ('gsi_visual','gsi_estructura','gsi_superficie','control_estructural','efectos_voladura','ucs_mpa','is50_mpa'):
        h[key] = rmr.get(key)
    for stem in ('este','norte','cota'):
        h[stem+'_from']=data.get(stem+'_ini');h[stem+'_to']=data.get(stem+'_fin')
    keys = dict(fam='familia',dist='distancia',tipo='tipo_estructura',dip='dip',dipdir='dip_dir',aber='abertura',esp='espesor',cont='continuidad',espac='espaciamiento',nstr='n_estructuras',next='extremos_visibles',term='terminacion',r1='relleno1',r2='relleno2',jrc='jrc',rug='rugosidad',forma='forma',alt='alteracion')
    joints=[]
    for i,row in enumerate(data.get('discontinuidades') or []):
        joints.append({**{target:row.get(source) for source,target in keys.items()}, 'id':row.get('estructura_id') or i})
    return {'header':h,'joints':joints}


def from_import(item):
    h = item.excel_data
    data = {**h, 'codigo':item.codigo_final, 'fecha_mapeo':h.get('fecha'), 'distancia_celda':h.get('largo_m'),
            'mapeador':h.get('mapeador'), 'sector_geotecnico':first(h,'sector_geotecnico','sector'),
            'rmr_input':{**h,'agua_codigo':first(h,'condicion_agua','agua_codigo'), 'resistencia_codigo':first(h,'resistencia_codigo','resistencia_ucs')}}
    structures = item.estructuras
    aliases={'familia_id':'fam','distancia_m':'dist','tipo_estructura':'tipo','dip_dir':'dipdir','abertura_mm':'aber','espesor_mm':'esp','continuidad_m':'cont','espaciamiento_m':'espac','n_estructuras':'nstr','n_extremos_visibles':'next','terminacion':'term','relleno_1_codigo':'r1','relleno_2_codigo':'r2','rugosidad_codigo':'rug','forma_estructura':'forma','alteracion_codigo':'alt'}
    data['discontinuidades']=[{**s,**{target:s.get(source) for source,target in aliases.items()}} for s in structures]
    rmr = data['rmr_input']
    for target, sources in {
        'agua_codigo':('condicion_agua_rmr89','condicion_agua_rmr76','condicion_agua'),
        'resistencia_codigo':('dureza_rmr89','dureza_rmr76','resistencia_ucs'),
        'gsi_visual':('gsi_visual_rmr89','gsi_visual_rmr76','gsi_visual'),
        'control_estructural':('control_estructural_rmr89','control_estructural_rmr76','control_estructural'),
        'efectos_voladura':('efectos_voladura_rmr89','efectos_voladura_rmr76','efectos_voladura'),
    }.items():
        rmr[target] = first(h,*sources)
    return from_save(data)


def resolve_excel_keys(clean_headers):
    """Pre-resolve canonical HEADER_COLUMNS and JOINT_COLUMNS once per Excel workbook."""
    from .predicates import _clean_k
    exact = {col for col in clean_headers if not str(col).startswith('Unnamed:')}
    norm_map = {}
    for col in clean_headers:
        if not str(col).startswith('Unnamed:'):
            norm_map.setdefault(_clean_k(col), col)

    def _map(columns):
        return {
            key: (col if col in exact else norm_map.get(_clean_k(col)))
            for key, col in columns.items()
        }

    return _map(HEADER_COLUMNS), _map(JOINT_COLUMNS)


def from_excel(row, length=None, *, header_keys=None, joint_keys=None, include_header=True):
    from .predicates import get_row_val
    if include_header:
        if header_keys is not None:
            header = {key: (row.get(col) if col is not None else None) for key, col in header_keys.items()}
        else:
            header = {key: get_row_val(row, col) for key, col in HEADER_COLUMNS.items()}
        header['largo'] = length
    else:
        header = {'largo': length}
    if joint_keys is not None:
        joint = {key: (row.get(col) if col is not None else None) for key, col in joint_keys.items()}
    else:
        joint = {key: get_row_val(row, col) for key, col in JOINT_COLUMNS.items()}
    return {'header': header, 'joints': [joint]}
