"""Non-destructive input handling for interactive and import adapters."""
import math


def blank(value):
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip().upper() in ('', '-1', '-1.0', 'N/A', 'NONE', 'NULL', 'NAN')
    return value == -1 or (isinstance(value, float) and math.isnan(value))


def number(value, *, sentinel=True):
    if (sentinel and blank(value)) or value is None or isinstance(value, bool):
        return None
    try:
        result = float(str(value).strip().replace(',', '.'))
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def js_round(value, digits=0):
    scale = 10 ** digits
    return math.floor(value * scale + 0.5) / scale


def first(mapping, *keys):
    """Unlike `a or b`, a valid zero is not discarded."""
    return next((mapping[k] for k in keys if mapping.get(k) is not None), None)
