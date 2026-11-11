"""Run in isolation: substitutes DB/auth modules BEFORE importing real routers.

The strict fake session raises on any access. No engine, dotenv, SQL connection
or application startup is imported by this fixture.
"""
import importlib
import sys
import types
from pathlib import Path
import pytest
from fastapi import FastAPI, Header, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import declarative_base


@pytest.fixture
def client(monkeypatch):
    class NoDatabase:
        def __getattr__(self,name):
            raise AssertionError(f'Validation reached the database: {name}')
    def get_db():yield NoDatabase()
    def no_session(*args,**kwargs):raise AssertionError('SessionLocal called')
    fake=types.ModuleType('app.database')
    fake.Base=declarative_base();fake.get_db=get_db;fake.SessionLocal=no_session
    monkeypatch.setitem(sys.modules,'app.database',fake)
    auth=types.ModuleType('app.auth.dependencies')
    def get_user(authorization: str | None=Header(None)):
        if authorization != 'Bearer test':raise HTTPException(401,'Authentication required')
        return types.SimpleNamespace(usuario='test')
    auth.get_current_user=get_user;auth.require_role=lambda roles:get_user
    monkeypatch.setitem(sys.modules,'app.auth.dependencies',auth)
    # routers/__init__.py eagerly imports unrelated report/PLT routers.
    package=types.ModuleType('app.routers')
    package.__path__=[str(Path(__file__).parents[1]/'app/routers')]
    monkeypatch.setitem(sys.modules,'app.routers',package)
    # Fresh modules are needed when fixtures run more than once.
    for name in ('app.models','app.routers.ventanas','app.routers.importador','app.routers.validation'):
        monkeypatch.delitem(sys.modules,name,raising=False)
    app=FastAPI()
    for name in ('validation','ventanas','importador'):
        mod=importlib.import_module('app.routers.'+name)
        app.include_router(mod.router,prefix='/api')
    validation=importlib.import_module('app.routers.validation')
    windows=importlib.import_module('app.routers.ventanas')
    importer=importlib.import_module('app.routers.importador')
    # Call the real handlers and Pydantic contracts directly. Windows sandbox
    # denies the loopback socketpair needed even by an in-process TestClient.
    yield types.SimpleNamespace(app=app, validation=validation, windows=windows,
        importer=importer, db=NoDatabase(), user=get_user('Bearer test'))


AUTH={'Authorization':'Bearer test'}


def test_preview_needs_auth_and_returns_correlated_results(client):
    payload={'request_id':'7','draft_revision':7,'windows':[{'header':{},'joints':[]}]}
    route=next(r for r in client.validation.router.routes if getattr(r,'path','')=='/validation/windows/preview')
    assert route.dependant.dependencies  # Authentication dependency is registered.
    data=client.validation.preview(client.validation.PreviewRequest(**payload),user=client.user)
    assert data['draft_revision']==7
    assert data['request_id']=='7'
    assert data['windows'][0]['can_save'] is False


def test_invalid_save_rejected_before_any_database_access(client):
    with pytest.raises(HTTPException) as error:
        client.windows.save_ventana(client.windows.schemas.VentanaSaveSchema(codigo='INVALID'),db=client.db,current_user=client.user)
    assert error.value.status_code==422
    assert error.value.detail['code']=='VALIDATION_FAILED'


def test_invalid_import_rejected_before_any_database_access(client):
    payload=client.importer.ImportExecuteSchema(celdas=[{
        'codigo_original':'X','codigo_final':'X','excel_data':{},'estructuras':[]}])
    with pytest.raises(HTTPException) as error:
        client.importer.execute_import_excel(payload,db=client.db,current_user=client.user)
    assert error.value.status_code==422
    assert error.value.detail['code']=='VALIDATION_FAILED'


def test_catalog_scope_version_and_active_state(client):
    data=client.validation.get_rules(view='mapeo_ventana',active_only=True,user=client.user)
    assert data['ruleset_version'].startswith('mapeo-v1.')
    assert all(r['enabled'] and 'mapeo_ventana' in r['views'] for r in data['rules'])
    assert data['required_fields']['header']


def test_preview_limits_and_scalar_types(client):
    for windows in ([],[{'header':{}}]*21,[{'header':{'altura':{'bad':'object'}}}]):
        with pytest.raises(ValidationError):
            client.validation.PreviewRequest(windows=windows)
