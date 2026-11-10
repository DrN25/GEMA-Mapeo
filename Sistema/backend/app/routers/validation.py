"""Read-only validation endpoints; existing authentication may read SQL.

The validation engine itself neither opens SQL connections nor writes files.
"""
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query
from app.auth.dependencies import get_current_user
from app.validation.service import evaluate_window, catalog_data, ruleset_version

router = APIRouter()


Scalar = str | int | float | None


class Draft(BaseModel):
    header: dict[str, Scalar]
    joints: list[dict[str, Scalar]] = Field(default_factory=list, max_length=10000)


class PreviewRequest(BaseModel):
    request_id: str = Field(default='', max_length=100)
    draft_revision: int = 0
    project: str = Field(default='ferrobamba', pattern='^(ferrobamba|chalco)$')
    windows: list[Draft] = Field(min_length=1, max_length=20)


def campaign_year(value):
    # Read-only mapping of the existing application campaign catalog. Never use
    # the client-provided year to select a different validation policy.
    from app.validation.context import campaign_year as resolve
    return resolve(value)


@router.get('/validation/rules')
def get_rules(view: str | None = None, active_only: bool = Query(True), user=Depends(get_current_user)):
    data=catalog_data()
    data['rules']=[r for r in data['rules'] if (not active_only or r['enabled']) and (not view or view in r['views'])]
    # Existing descriptors may contain recommendations. This endpoint exposes
    # public observations only, independently of the caller's role.
    from app.validation.registry import RULES_REGISTRY
    for rule in data['rules']:
        rule['message_template']=RULES_REGISTRY[rule['id']].observation_template
    return data


@router.post('/validation/windows/preview')
def preview(data: PreviewRequest, user=Depends(get_current_user)):
    return {'request_id':data.request_id,'draft_revision':data.draft_revision,
        'ruleset_version':ruleset_version(),'status':'complete',
        'windows':[evaluate_window(w.model_dump(),project=data.project,campaign_year=campaign_year(w.header.get('campania'))) for w in data.windows]}
