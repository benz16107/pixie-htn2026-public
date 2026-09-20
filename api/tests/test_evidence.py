import base64
import hashlib
import io
import json
import zipfile
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from atlas_api.evidence_routes import router

PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP8sAAAAASUVORK5CYII=')
@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('PIXIE_EVIDENCE_DB',str(tmp_path/'evidence.sqlite'))
    app=FastAPI();app.include_router(router)
    with TestClient(app) as client: yield client

def incident(client):
    response=client.post('/consumer/incidents',json={'clientId':'driver-test','address':'Queen & Spadina','lat':43.6488,'lng':-79.3963,'happenedAt':'2026-09-19T12:00:00Z','kind':'Collision','description':'Example incident','vehicle':'Example car','reward':2,'requestOpen':True,'consent':True})
    assert response.status_code==200,response.text
    return response.json()['id']

def upload(client,ref,**patch):
    return client.post(f'/consumer/incidents/{ref}/evidence',json={'clientId':'witness-test','role':'bystander','filename':'scene.png','mime':'image/png','content':base64.b64encode(PNG).decode(),'statement':'An example scene','anonymous':True,'consent':True,**patch})

def test_cross_role_review_credit_and_export(client):
    ref=incident(client);result=upload(client,ref);assert result.status_code==200,result.text
    file=result.json()['evidence'][0]
    assert file['sha256']==hashlib.sha256(PNG).hexdigest()
    assert file['credit']==0
    assert file['checks']['distanceMetres'] is None
    assert file['checks']['timeDifferenceSeconds'] is None
    assert file['checks']['device']=='Not verified'
    reviewed=client.post(f"/consumer/incidents/{ref}/evidence/{file['id']}/review",json={'status':'accepted','note':'Relevant scene for case review'}).json()
    assert reviewed['evidence'][0]['credit']==2
    client.post(f"/consumer/incidents/{ref}/evidence/{file['id']}/review",json={'status':'accepted','note':'Relevant scene for case review'})
    assert client.get(f'/consumer/incidents/{ref}').json()['evidence'][0]['credit']==2
    response=client.get(f'/consumer/incidents/{ref}/export')
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        manifest=json.loads(archive.read('manifest.json'))
        assert manifest['id']==ref
        assert hashlib.sha256(archive.read(f"files/{file['id']}.png")).hexdigest()==file['sha256']
    rejected=client.post(f"/consumer/incidents/{ref}/evidence/{file['id']}/review",json={'status':'rejected','note':'Not relevant after further review'}).json()
    assert rejected['evidence'][0]['credit']==0

def test_duplicates_metadata_and_range(client):
    ref=incident(client)
    first=upload(client,ref,capturedAt='2026-09-19T12:00:20Z',lat=43.6488,lng=-79.3963).json()['evidence'][0]
    assert first['checks']['distanceMetres']==0
    assert first['checks']['timeDifferenceSeconds']==20
    assert upload(client,ref).status_code==409
    response=client.get(first['mediaPath'],headers={'range':'bytes=0-9'})
    assert response.status_code==206
    assert response.content==PNG[:10]
    assert response.headers['content-range']==f'bytes 0-9/{len(PNG)}'
    assert client.get(first['mediaPath'],headers={'range':'bytes=99999-'}).status_code==416

def test_validation_closed_requests_and_ownership(client):
    ref=incident(client)
    assert upload(client,ref,consent=False).status_code==422
    assert upload(client,ref,content='invalid-base64').status_code==422
    assert upload(client,ref,mime='image/jpeg').status_code==415
    assert upload(client,ref,capturedAt='2026-09-19T12:00:00').status_code==422
    assert upload(client,ref,role='driver').status_code==403
    assert client.post(f'/consumer/incidents/{ref}/request',json={'clientId':'other-person','requestOpen':False,'reward':2}).status_code==403
    client.post(f'/consumer/incidents/{ref}/status',json={'status':'closed','note':'Review complete'})
    assert upload(client,ref).status_code==409
    client.post(f'/consumer/incidents/{ref}/status',json={'status':'open','note':'New evidence requested'})
    assert upload(client,ref).status_code==409
    client.post(f'/consumer/incidents/{ref}/request',json={'clientId':'driver-test','requestOpen':True,'reward':5})
    own=upload(client,ref,clientId='driver-test',role='driver').json()['evidence'][0]
    result=client.post(f"/consumer/incidents/{ref}/evidence/{own['id']}/review",json={'status':'accepted','note':'Own driver footage'}).json()
    assert result['evidence'][0]['credit']==0

def test_concurrent_duplicate_uploads_do_not_duplicate_credit_or_events(client):
    ref=incident(client)
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses=list(pool.map(lambda _:upload(client,ref).status_code,range(2)))
    assert sorted(statuses)==[200,409]
    result=client.get(f'/consumer/incidents/{ref}').json()
    assert len(result['evidence'])==1
    assert len(result['events'])==2

def test_repeatable_demo_and_reporter_deletion(client):
    first=client.post('/consumer/incidents/demo',json={'clientId':'demo-test-device','role':'driver'})
    assert first.status_code==200,first.text
    record=first.json();ref=record['id']
    assert len(record['evidence'])==2
    assert record['evidence'][0]['capturedAt'] is None
    assert client.post('/consumer/incidents/demo',json={'clientId':'demo-test-device','role':'driver'}).json()['id']==ref
    assert client.post(f'/consumer/incidents/{ref}/delete',json={'clientId':'another-device'}).status_code==403
    assert client.post(f'/consumer/incidents/{ref}/delete',json={'clientId':'demo-test-device'}).status_code==200
    assert client.get(f'/consumer/incidents/{ref}').status_code==404
    assert client.get(record['evidence'][0]['mediaPath']).status_code==404
