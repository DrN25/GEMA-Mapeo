"""Campaign identity used by the existing application catalog.

This is a read-only application catalog, not a new SQL table or fallback to a
different campaign. Unknown IDs remain unknown and cannot select a formula.
"""
CAMPAIGNS = ((1,2020),(2,2021),(3,2022),(4,2023),(5,2024),(6,2025),(7,2026),(8,2019))


def campaign_year(value):
    try:
        value=int(value)
    except (ValueError,TypeError):
        return None
    return value if 1900 <= value <= 2100 else dict(CAMPAIGNS).get(value)


def assert_valid(result):
    if not result['can_save']:
        from fastapi import HTTPException
        raise HTTPException(422,detail={'code':'VALIDATION_FAILED',
            'ruleset_version':result['ruleset_version'],'issues':result['issues'],
            'message':'Corrija los errores críticos y campos obligatorios antes de guardar.'})
