"""Shared demo evidence workspace. Integrity checks do not determine authenticity or fault."""
from __future__ import annotations

import base64
import binascii
import hashlib
import io
import json
import math
import os
import sqlite3
import uuid
import zipfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

router = APIRouter(prefix="/consumer/incidents", tags=["Recovery evidence"])
MAX_BYTES = 12 * 1024 * 1024
MIMES = {"image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"}
DISCLAIMER = "Shared prototype workspace. Use demo material only. Integrity checks do not establish authenticity, fault, coverage, or a payment entitlement."


@contextmanager
def connect():
    path = Path(os.getenv("PIXIE_EVIDENCE_DB", str(Path(__file__).resolve().parents[3] / "var" / "evidence.sqlite")))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.executescript('''CREATE TABLE IF NOT EXISTS incidents(id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY, incident TEXT NOT NULL, data TEXT NOT NULL, content BLOB NOT NULL, hash TEXT NOT NULL, UNIQUE(incident,hash));''')
    try:
        with db:
            db.execute("BEGIN IMMEDIATE")
            yield db
    finally:
        db.close()


def now(): return datetime.now(timezone.utc).isoformat()
def ident(prefix): return f"PX-{prefix}-{uuid.uuid4().hex[:10].upper()}"
def encode(value): return json.dumps(value, separators=(",", ":"))


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class IncidentInput(Input):
    clientId: str = Field(min_length=8, max_length=100)
    address: str = Field(min_length=3, max_length=200)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    happenedAt: datetime
    kind: Literal["Collision", "Hit and run", "Parked damage", "Other"]
    description: str = Field(default="", max_length=3000)
    vehicle: str = Field(default="", max_length=120)
    reward: Literal[0, 1, 2, 5] = 0
    requestOpen: bool = False
    consent: Literal[True]

    @field_validator("happenedAt")
    @classmethod
    def time_valid(cls, value):
        if value.tzinfo is None or value > datetime.now(timezone.utc):
            raise ValueError("Use a past incident time with a time zone")
        return value


class EvidenceInput(Input):
    clientId: str = Field(min_length=8, max_length=100)
    role: Literal["driver", "bystander"]
    filename: str = Field(min_length=1, max_length=120)
    mime: str
    content: str = Field(min_length=1, max_length=MAX_BYTES * 4 // 3 + 4)
    capturedAt: datetime | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    statement: str = Field(default="", max_length=3000)
    anonymous: bool = True
    consent: Literal[True]

    @field_validator("capturedAt")
    @classmethod
    def time_valid(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError("Capture time needs a time zone")
        return value


class ReviewInput(Input):
    status: Literal["pending", "accepted", "rejected"]
    note: str = Field(min_length=3, max_length=2000)


class UpdateInput(Input):
    status: Literal["open", "reviewing", "closed"]
    note: str = Field(min_length=3, max_length=2000)


class RequestInput(Input):
    clientId: str
    requestOpen: bool
    reward: Literal[0, 1, 2, 5]


def get(db, incident_id):
    row = db.execute("SELECT data FROM incidents WHERE id=?", (incident_id,)).fetchone()
    if not row: raise HTTPException(404, "Incident not found")
    return json.loads(row["data"])


def put(db, incident):
    db.execute("INSERT OR REPLACE INTO incidents VALUES(?,?)", (incident["id"], encode(incident)))


def distance(a, b, c, d):
    # Haversine, metres. Inputs are contributor-declared, never attested GPS.
    p1, p2 = math.radians(a), math.radians(c)
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(d-b)/2)**2
    return round(6371000 * 2 * math.asin(min(1, math.sqrt(h))))


def full(db, incident):
    evidence = [json.loads(r["data"]) for r in db.execute("SELECT data FROM evidence WHERE incident=? ORDER BY rowid", (incident["id"],))]
    for item in evidence:
        item["credit"] = item["rewardAtSubmission"] if item["status"] == "accepted" and item["role"] == "bystander" and item["clientId"] != incident["clientId"] else 0
        item["mediaPath"] = f"/consumer/incidents/{incident['id']}/evidence/{item['id']}/media"
    return {**incident, "evidence": evidence, "counts": {"submitted": len(evidence), "accepted": sum(e["status"] == "accepted" for e in evidence), "pending": sum(e["status"] == "pending" for e in evidence)}, "disclaimer": DISCLAIMER}


@router.get("")
def list_incidents():
    with connect() as db:
        return {"incidents": [full(db, json.loads(row["data"])) for row in db.execute("SELECT data FROM incidents ORDER BY rowid DESC")], "disclaimer": DISCLAIMER}


@router.post("")
def create_incident(body: IncidentInput):
    if (body.lat is None) != (body.lng is None): raise HTTPException(422, "Provide both coordinates or neither")
    incident = {**body.model_dump(mode="json", exclude={"consent"}), "id": ident("ROAD"), "createdAt": now(), "status": "open", "events": [{"at": now(), "text": "Driver shared the incident with the demo evidence workspace."}]}
    with connect() as db:
        put(db, incident)
        return full(db, incident)


@router.get("/{incident_id}")
def read_incident(incident_id: str):
    with connect() as db: return full(db, get(db, incident_id))


@router.post("/{incident_id}/request")
def footage_request(incident_id: str, body: RequestInput):
    with connect() as db:
        incident = get(db, incident_id)
        if incident["clientId"] != body.clientId: raise HTTPException(403, "Only the reporter can change this request")
        if incident["status"] == "closed": raise HTTPException(409, "Reopen the incident before requesting footage")
        incident.update(requestOpen=body.requestOpen, reward=body.reward)
        incident["events"].append({"at": now(), "text": "Footage request opened in the bystander feed." if body.requestOpen else "Footage request paused."})
        put(db, incident)
        return full(db, incident)


def valid_media(data, mime):
    return ((mime == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n")) or
            (mime == "image/jpeg" and data.startswith(b"\xff\xd8\xff")) or
            (mime == "image/webp" and data.startswith(b"RIFF") and data[8:12] == b"WEBP") or
            (mime in {"video/mp4", "video/quicktime"} and data[4:8] == b"ftyp") or
            (mime == "video/webm" and data.startswith(b"\x1a\x45\xdf\xa3")))


@router.post("/{incident_id}/evidence")
async def upload(incident_id: str, request: Request):
    # Bound streamed input before JSON/base64 decoding.
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > MAX_BYTES * 4 // 3 + 20000: raise HTTPException(413, "Choose a file up to 12 MB")
    try:
        body = EvidenceInput.model_validate_json(raw)
    except ValueError:
        raise HTTPException(422, "Check the file, metadata and sharing consent")
    try: data = base64.b64decode(body.content, validate=True)
    except binascii.Error: raise HTTPException(422, "Invalid file encoding")
    if not data or len(data) > MAX_BYTES: raise HTTPException(413, "Choose a file up to 12 MB")
    if body.mime not in MIMES or not valid_media(data, body.mime): raise HTTPException(415, "Use a PNG, JPEG, WebP, MP4, MOV or WebM file")
    if (body.lat is None) != (body.lng is None): raise HTTPException(422, "Provide both coordinates or neither")
    with connect() as db:
        incident = get(db, incident_id)
        if incident["status"] == "closed": raise HTTPException(409, "This incident is closed")
        if body.role == "driver" and body.clientId != incident["clientId"]: raise HTTPException(403, "Use bystander contribution for someone else's incident")
        if body.role == "bystander" and not incident["requestOpen"]: raise HTTPException(409, "The reporter is not requesting footage")
        digest = hashlib.sha256(data).hexdigest()
        if db.execute("SELECT 1 FROM evidence WHERE incident=? AND hash=?", (incident_id,digest)).fetchone(): raise HTTPException(409, "This exact file is already attached to the incident")
        delta = abs((body.capturedAt-datetime.fromisoformat(incident["happenedAt"])).total_seconds()) if body.capturedAt else None
        metres = distance(body.lat,body.lng,incident["lat"],incident["lng"]) if None not in (body.lat,body.lng,incident["lat"],incident["lng"]) else None
        evidence = {**body.model_dump(mode="json", exclude={"content","consent"}), "id": ident("EV"), "sha256": digest, "bytes": len(data), "submittedAt": now(), "status": "pending", "reviewNote": "", "rewardAtSubmission": incident["reward"] if incident["requestOpen"] else 0, "checks": {"integrity": "SHA-256 calculated from uploaded bytes", "timeDifferenceSeconds": delta, "distanceMetres": metres, "metadataSource": "Contributor-declared; not device-attested", "authenticity": "Not established", "device": "Not verified"}}
        db.execute("INSERT INTO evidence VALUES(?,?,?,?,?)", (evidence["id"], incident_id, encode(evidence), data, digest))
        incident["events"].append({"at":now(),"text":f"{body.role.title()} added a file. Hash recorded; review pending."})
        put(db,incident)
        return full(db,incident)


@router.post("/{incident_id}/evidence/{evidence_id}/review")
def review(incident_id: str, evidence_id: str, body: ReviewInput):
    with connect() as db:
        incident = get(db,incident_id)
        if incident["status"] == "closed": raise HTTPException(409, "Reopen this incident before reviewing evidence")
        row = db.execute("SELECT data FROM evidence WHERE id=? AND incident=?", (evidence_id,incident_id)).fetchone()
        if not row: raise HTTPException(404,"Evidence not found")
        item = json.loads(row["data"])
        item.update(status=body.status,reviewNote=body.note,reviewedAt=now())
        db.execute("UPDATE evidence SET data=? WHERE id=?", (encode(item),evidence_id))
        incident["events"].append({"at":now(),"text":f"Reviewer marked {evidence_id} {body.status}: {body.note}"})
        put(db,incident)
        return full(db,incident)


@router.post("/{incident_id}/status")
def status(incident_id: str, body: UpdateInput):
    with connect() as db:
        incident=get(db,incident_id)
        incident["status"]=body.status
        if body.status == "closed": incident["requestOpen"]=False
        incident["events"].append({"at":now(),"text":f"Reviewer set incident to {body.status}: {body.note}"})
        put(db,incident)
        return full(db,incident)


@router.get("/{incident_id}/evidence/{evidence_id}/media")
def media(incident_id: str, evidence_id: str, request: Request):
    with connect() as db:
        row=db.execute("SELECT data,content FROM evidence WHERE incident=? AND id=?",(incident_id,evidence_id)).fetchone()
        if not row: raise HTTPException(404,"File not found")
        data = bytes(row["content"])
        headers = {"X-Content-Type-Options":"nosniff", "Cache-Control":"no-store", "Accept-Ranges":"bytes"}
        status_code = 200
        requested = request.headers.get("range")
        if requested:
            try:
                unit, span = requested.split("=", 1)
                left, right = span.split("-", 1)
                if unit != "bytes" or "," in span: raise ValueError()
                start = int(left) if left else max(0, len(data)-int(right))
                end = min(int(right),len(data)-1) if left and right else len(data)-1
                if not 0 <= start <= end < len(data): raise ValueError()
            except ValueError:
                return Response(status_code=416,headers={"Content-Range":f"bytes */{len(data)}"})
            headers["Content-Range"] = f"bytes {start}-{end}/{len(data)}"
            data = data[start:end+1]
            status_code = 206
        return Response(data,status_code=status_code,media_type=json.loads(row["data"])["mime"],headers=headers)


@router.get("/{incident_id}/export")
def export(incident_id: str):
    with connect() as db:
        incident=full(db,get(db,incident_id))
        result=io.BytesIO()
        with zipfile.ZipFile(result,"w",zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("manifest.json",json.dumps(incident,indent=2))
            archive.writestr("READ-ME.txt",DISCLAIMER+"\nFile hashes demonstrate the bytes exported match those received. All capture metadata is contributor-declared. Reviewer acceptance is not a fault or authenticity determination.")
            for row in db.execute("SELECT data,content FROM evidence WHERE incident=?",(incident_id,)):
                item=json.loads(row["data"])
                ext={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","video/mp4":"mp4","video/quicktime":"mov","video/webm":"webm"}[item["mime"]]
                archive.writestr(f"files/{item['id']}.{ext}",row["content"])
        return Response(result.getvalue(),media_type="application/zip",headers={"Content-Disposition":f'attachment; filename="{incident_id}-evidence.zip"',"Cache-Control":"no-store"})


class DemoInput(Input):
    clientId: str = Field(min_length=8, max_length=100)
    role: Literal["driver", "bystander"] = "driver"


@router.post('/demo')
def demo(body: DemoInput):
    """Idempotent illustrated example, explicitly not camera evidence."""
    from datetime import timedelta
    key = hashlib.sha256(f'{body.clientId}:{body.role}'.encode()).hexdigest()[:10].upper()
    incident_id = f'PX-DEMO-{key}'
    with connect() as db:
        if db.execute('SELECT 1 FROM incidents WHERE id=?',(incident_id,)).fetchone():
            return full(db,get(db,incident_id))
        captured = (datetime.now(timezone.utc)-timedelta(minutes=15)).isoformat()
        owner = body.clientId if body.role == 'driver' else 'example-driver'
        incident = {'id':incident_id,'clientId':owner,'address':'Queen & Spadina · Illustrated example','lat':43.6488,'lng':-79.3963,'happenedAt':captured,'createdAt':now(),'kind':'Collision','description':'Illustrated example only. Two vehicles approach an intersection. These diagrams demonstrate how perspectives reach an insurer; they are not recordings of a real collision.','vehicle':'Example Toyota Corolla','reward':2,'requestOpen':True,'status':'open','example':True,'events':[{'at':now(),'text':'Illustrated example created. The attached diagrams are not real scene recordings.'}]}
        put(db,incident)
        for index in range(2):
            content=(Path(__file__).resolve().parents[2]/'fixtures'/'evidence'/f'perspective-{chr(97+index)}.png').read_bytes()
            digest=hashlib.sha256(content).hexdigest()
            item={'id':ident('EV'),'clientId':owner if index==0 else 'example-witness','role':'driver' if index==0 else 'bystander','filename':f'illustrated-perspective-{index+1}.png','mime':'image/png','bytes':len(content),'sha256':digest,'submittedAt':now(),'capturedAt':None,'lat':None,'lng':None,'statement':'Illustrated demo scene, not captured footage. No facts about a real incident can be inferred.','anonymous':True,'status':'pending','reviewNote':'','rewardAtSubmission':0,'example':True,'checks':{'integrity':'SHA-256 calculated from example image bytes','timeDifferenceSeconds':None,'distanceMetres':None,'metadataSource':'Illustrated example; no device metadata','authenticity':'Not a real incident recording','device':'Not verified'}}
            db.execute('INSERT INTO evidence VALUES(?,?,?,?,?)',(item['id'],incident_id,encode(item),content,digest))
        return full(db,incident)


class DeleteInput(Input):
    clientId: str = Field(min_length=8,max_length=100)


@router.post('/{incident_id}/delete')
def delete(incident_id: str, body: DeleteInput):
    with connect() as db:
        incident=get(db,incident_id)
        if incident['clientId']!=body.clientId: raise HTTPException(403,'Only the reporter can remove this demo incident')
        db.execute('DELETE FROM evidence WHERE incident=?',(incident_id,))
        db.execute('DELETE FROM incidents WHERE id=?',(incident_id,))
        return {'deleted':incident_id}
