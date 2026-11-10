"""Rules formerly exclusive to the mapping editor, now Python-only.

Each record owns its parameters and evaluator. The public catalog is a projection
of these records, not a second hand-maintained description of their limits.
"""
from dataclasses import dataclass, field
from .normalization import number, blank


@dataclass(frozen=True)
class WindowRule:
    code: str
    field: str
    message: str
    kind: str
    parameters: dict = field(default_factory=dict)
    severity: str = 'CRITICA'
    scope: tuple = ('frontend', 'backend')
    operations: tuple = ('window_preview','window_save','import_save','excel_review')
    enabled: bool = True

    def fails(self, row, header, length, year, effective_gsi):
        value = number(row.get(self.field))
        p = self.parameters
        if self.kind == 'range':
            return value is not None and not p['min'] <= value <= p['max']
        if self.kind == 'zero':
            return value == 0
        if self.kind == 'negative':
            return value is not None and value < 0
        if self.kind == 'max':
            return value is not None and value > p['max']
        if self.kind == 'integer':
            return value is not None and not value.is_integer()
        if self.kind == 'length':
            return value is not None and length is not None and value / p.get('scale', 1) > length and str(row.get('tipo_estructura', '')).upper() not in p.get('except_types', [])
        if self.kind == 'zero_aperture':
            return value == 0 and (number(row.get('espesor')) or 0) > 0
        if self.kind == 'clean_filling':
            # Missing material is handled by required fields, not treated as clean.
            return value is not None and value != 0 and str(row.get('relleno1', '')).strip().lower() in p['codes']
        if self.kind == 'campaign_date':
            date = str(header.get('fecha') or '')
            return bool(year and len(date) >= 4 and date[:4].isdigit() and int(date[:4]) != year)
        if self.kind == 'jrc_profile':
            rug = number(row.get('rugosidad'))
            if value is None or rug is None or not 0 <= value <= 20:
                return False
            expected = next(profile for upper, profile in p['bands'] if value < upper or upper == 20)
            return expected != rug
        if self.kind == 'gsi_range':
            from app.core.catalogs import GSI_SUPERFICIE_DISPLAY_CATALOG, GSI_ESTRUCTURA_DISPLAY_CATALOG
            est = next((x for x in GSI_ESTRUCTURA_DISPLAY_CATALOG if x['codigo'] == str(header.get('gsi_estructura', '')).upper()), None)
            sup = next((x for x in GSI_SUPERFICIE_DISPLAY_CATALOG if x['codigo'] == str(header.get('gsi_superficie', '')).upper()), None)
            return effective_gsi is not None and est is not None and sup is not None and not est['min'] + sup['min'] <= effective_gsi <= min(85, est['max'] + sup['max'])
        raise ValueError(f'Unknown evaluator: {self.kind}')


WINDOW_RULES = []


def add(code, field, message, kind, severity='CRITICA', *,
        scope=('frontend','backend'), operations=None, enabled=True, **parameters):
    options={'scope':tuple(scope),'enabled':enabled}
    if operations is not None:options['operations']=tuple(operations)
    WINDOW_RULES.append(WindowRule(code, field, message, kind, parameters, severity, **options))


for field, prefix, label in [('largo', 'LARGO', 'La distancia de celda'), ('altura', 'ALTURA', 'La altura')]:
    add(prefix + '_CERO', field, label + ' no puede ser cero.', 'zero')
    add(prefix + '_NEGATIVO' if field == 'largo' else 'ALTURA_NEGATIVA', field, label + ' no puede ser negativa.', 'negative')
    add(prefix + '_MAXIMO' if field == 'largo' else 'ALTURA_MAXIMA', field, label + ' supera 30 m; verifique el dato.', 'max', 'ADVERTENCIA', max=30)
for code, field, lower, upper, label in [
    ('DIP_HW_RANGO', 'dip_hw', -90, 90, 'Dip HW'),
    ('DIPDIR_TALUD_RANGO', 'dipdir_talud', 0, 359.99, 'DipDir talud'),
    ('AZ_HW_RANGO', 'az_hw', 0, 359.99, 'Azimut HW'),
    ('DIP_DIR_RANGO', 'dip_dir', 0, 359, 'DipDir de estructura'),
]:
    add(code, field, f'{label} debe estar entre {lower} y {upper} grados.', 'range', min=lower, max=upper)
for prefix, field, label in [('FASE', 'fase', 'Fase'), ('NIVEL', 'nivel', 'Nivel'), ('N_ESTRUCTURAS', 'n_estructuras', 'Número de estructuras')]:
    add(prefix + '_CERO', field, label + ' no puede ser cero.', 'zero')
    add(prefix + ('_NEGATIVA' if prefix == 'FASE' else '_NEGATIVO'), field, label + ' no puede ser negativo.', 'negative')
for code, field, label in [('DIP_ESTRUCTURA_ENTERO', 'dip', 'Dip'), ('DIP_DIR_ENTERO', 'dip_dir', 'DipDir'), ('JRC_ENTERO', 'jrc', 'JRC'), ('RUGOSIDAD_ENTERO', 'rugosidad', 'Rugosidad'), ('GSI_VISUAL_ENTERO', 'gsi_visual', 'GSI visual')]:
    add(code, field, label + ' debe ser un número entero.', 'integer')
add('DISTANCIA_CERO', 'distancia', 'La distancia de estructura no puede ser cero.', 'zero')
add('ABERTURA_CERO_CON_ESPESOR', 'abertura', 'La abertura es cero pero el espesor de relleno es positivo.', 'zero_aperture')
add('ESPESOR_SUPERA_LARGO', 'espesor', 'El espesor de relleno supera el largo de celda.', 'length', scale=1000, except_types=['F', 'SZ', 'BED'])
add('ESPESOR_NO_CERO_RELLENO_LIMPIO', 'espesor', 'El relleno limpio debe tener espesor cero.', 'clean_filling', codes=['c', 'cwf'])
add('ESPACIAMIENTO_EXCEDE_LARGO', 'espaciamiento', 'El espaciamiento supera el largo de celda.', 'length')
add('FECHA_CAMPANA_ANIO', 'fecha', 'La fecha de mapeo no pertenece al año de la campaña.', 'campaign_date', 'ADVERTENCIA')
add('JRC_RUGOSIDAD_CATALOGO', 'jrc', 'La combinación de JRC y perfil de rugosidad no corresponde al catálogo.', 'jrc_profile', 'ADVERTENCIA', bands=[(2,9),(4,8),(6,7),(10,6),(12,5),(14,4),(16,3),(18,2),(20,1)])
add('GSI_VISUAL_NEGATIVO', 'gsi_visual', 'El GSI visual no puede ser negativo.', 'negative')
add('GSI_VISUAL_RANGO', 'gsi_visual', 'El GSI visual efectivo no corresponde al rango de estructura y superficie seleccionadas.', 'gsi_range')

JOINT_FIELDS = frozenset(('dip', 'dip_dir', 'n_estructuras', 'distancia', 'abertura', 'espesor', 'espaciamiento', 'jrc', 'rugosidad'))
