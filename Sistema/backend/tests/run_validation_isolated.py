r"""Run mapping/report regression tests with SQL access impossible.

Usage from Sistema/backend:
    .\.venv\Scripts\python.exe tests/run_validation_isolated.py

No application startup or .env loading. Test auth is a stub; this runner does
not test login/JWT. Only the explicitly selected mapping/report tests run.
"""
from pathlib import Path
import sys
import types
from sqlalchemy.orm import declarative_base

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def denied(*args,**kwargs):
    raise AssertionError('SQL access is forbidden in the isolated validation suite')


database=types.ModuleType('app.database')
database.Base=declarative_base()
database.SessionLocal=denied
database.get_db=denied
sys.modules['app.database']=database
auth=types.ModuleType('app.auth.dependencies')
auth.get_current_user=denied
auth.get_optional_current_user=lambda:None
auth.require_role=lambda roles:denied
sys.modules['app.auth.dependencies']=auth

if __name__=='__main__':
    import pytest
    tests=['test_validation_rules.py','test_validation_api.py','test_geology_profiles.py',
           'test_audit_helper.py','test_auditoria_excel_roles.py','test_excel_exporter.py']
    raise SystemExit(pytest.main([*[str(ROOT/'tests'/p) for p in tests],'-q',*sys.argv[1:]]))
