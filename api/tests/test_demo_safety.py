"""Demo state boundaries: a case reset is local and a live stream cannot replay older runs."""
import os
import time

import pytest
from fastapi.testclient import TestClient
from atlas_api import guideline
from atlas_api.app import app, get_store
from atlas_api.events import DeskEvent, NoteP


@pytest.fixture
def client(tmp_path):
    os.environ['ATLAS_DB'] = str(tmp_path / 'demo.sqlite')
    with TestClient(app) as client:
        guideline.reset()
        yield client
        guideline.reset()


def test_case_reset_preserves_other_case_and_active_rules(client):
    doc = client.get('/guideline').json()
    doc['thresholds']['accept'] = 75
    assert client.put('/guideline', json=doc).status_code == 200
    for cid in ('138', '141'):
        assert client.post(f'/cases/{cid}/override', json={'points': 3, 'reason': 'reviewed roof'}).status_code == 200
    response = client.post('/cases/138/reset')
    assert response.status_code == 200
    assert response.json()['cases'] == ['138']
    assert not client.get('/cases/138').json().get('override')
    assert client.get('/cases/141').json()['override']['points'] == 3
    assert client.get('/guideline').json()['thresholds']['accept'] == 75
    assert client.post('/cases/not-real/reset').status_code == 404


def test_live_stream_is_scoped_and_finishes(client):
    for run, text in [('old-run', 'old data must stay out'), ('new-run', 'new run complete')]:
        get_store().append(DeskEvent.make('138', run, 'lead', NoteP(text=text, calls=0), t0=time.time()))
    stream = client.get('/events/stream?cases=138&run_id=new-run').text
    assert 'old data must stay out' not in stream
    assert 'new run complete' in stream
    assert stream.endswith('event: done\ndata: {}\n\n')


def test_empty_recorded_stream_finishes(client):
    assert client.get('/events/stream?cases=138&replay=1&speed=0').text.endswith('event: done\ndata: {}\n\n')
