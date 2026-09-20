"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  evidenceClient,
  type RoadIncident,
  type Evidence,
} from "../../../../shared/evidence";
import styles from "./EvidenceDesk.module.css";
import { EvidenceMap } from "./EvidenceMap";
const api = evidenceClient("/api/intact/evidence");
const time = (v: string) => new Date(v).toLocaleString();
function FileReview({
  item,
  incident,
  changed,
}: {
  item: Evidence;
  incident: RoadIncident;
  changed: (value: RoadIncident) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function review(status: Evidence["status"]) {
    setBusy(true);
    setError("");
    try {
      changed(await api.review(incident.id, item.id, status, note));
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save review.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={styles.file}>
      <div className={styles.fileHead}>
        <div>
          <span className={styles.eyebrow}>{item.role} perspective</span>
          <h3>{item.filename}</h3>
        </div>
        <span className={styles.badge}>{item.status}</span>
      </div>
      {item.mime.startsWith("video/") ? (
        <video
          src={api.media(item)}
          controls
          preload="metadata"
          className={styles.media}
        />
      ) : (
         <Image
          unoptimized width={800} height={450}
          src={api.media(item)}
          alt={item.statement || `Uploaded ${item.role} perspective`}
          className={styles.media}
        />
      )}
      <div className={styles.fileBody}>
        <p>{item.statement || "No contributor statement supplied."}</p>
        <dl className={styles.facts}>
          <div>
            <dt>Contributor</dt>
            <dd>
              {item.anonymous
                ? "Anonymous"
                : item.role === "driver"
                  ? "Reporter"
                  : "Witness"}
            </dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{time(item.submittedAt)}</dd>
          </div>
          <div>
            <dt>Capture time</dt>
            <dd>{item.capturedAt ? time(item.capturedAt) : "Unknown"}</dd>
          </div>
          <div>
            <dt>Time from incident</dt>
            <dd>
              {item.checks.timeDifferenceSeconds === null
                ? "Unknown"
                : `${item.checks.timeDifferenceSeconds} seconds`}
            </dd>
          </div>
          <div>
            <dt>Distance from scene</dt>
            <dd>
              {item.checks.distanceMetres === null
                ? "Unknown"
                : `${item.checks.distanceMetres} metres`}
            </dd>
          </div>
          <div>
            <dt>Device origin</dt>
            <dd>Not verified</dd>
          </div>
        </dl>
        <p className={styles.note}>
          Time and location are contributor-declared. Multiple uploads are not
          proof of independent devices or corroboration.
        </p>
        <details>
          <summary>File integrity and provenance</summary>
          <p>
            SHA-256 calculated from {(item.bytes / 1024 / 1024).toFixed(2)} MB
            of uploaded bytes.
          </p>
          <code className={styles.hash}>{item.sha256}</code>
          <p>
            Matching this hash confirms identical bytes, not an authentic
            recording. Exact duplicate uploads are rejected.
          </p>
        </details>
        {item.reviewNote ? (
          <blockquote>
            <span className={styles.eyebrow}>Latest review</span>
            <p>{item.reviewNote}</p>
          </blockquote>
        ) : null}
        {item.credit > 0 ? (
          <p className={styles.note}>
            ${item.credit.toFixed(2)} demo contribution credit. No money or
            premium discount.
          </p>
        ) : null}
        <label className={styles.label}>
          Review note
          <textarea
            aria-label={`Review note for ${item.filename}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            placeholder="Relevance, missing facts, or why this needs another look."
          />
        </label>
        <div className={styles.actions}>
          <button
            disabled={
              busy || note.trim().length < 3 || incident.status === "closed"
            }
            onClick={() => review("accepted")}
          >
            Accept for case review
          </button>
          <button
            className={styles.secondary}
            disabled={
              busy || note.trim().length < 3 || incident.status === "closed"
            }
            onClick={() => review("rejected")}
          >
            Reject contribution
          </button>
          {item.status !== "pending" ? (
            <button
              className={styles.textButton}
              disabled={
                busy || note.trim().length < 3 || incident.status === "closed"
              }
              onClick={() => review("pending")}
            >
              Reopen review
            </button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
export function EvidenceDesk() {
  const [reports, setReports] = useState<RoadIncident[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const result = await api.list();
      setReports(result.incidents);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Evidence service unavailable.",
      );
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    let active = true;
    const load = () => api.list().then(result => {
      if (active) { setReports(result.incidents); setError(''); }
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : 'Evidence service unavailable.');
    }).finally(() => { if (active) setLoaded(true); });
    void load();
    const timer = setInterval(load, 8000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const incident = reports.find((r) => r.id === selected);
  const filtered = reports.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      `${r.id} ${r.address} ${r.kind}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const changed = (value: RoadIncident) =>
    setReports((old) => old.map((x) => (x.id === value.id ? value : x)));
  async function status(value: RoadIncident["status"]) {
    if (!incident) return;
    setBusy(true);
    setError("");
    try {
      changed(await api.status(incident.id, value, note));
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update incident.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Intact / insurer workspace</span>
          <h1>
            Every perspective.
            <br />
            One incident record.
          </h1>
          <p>
            Review footage shared by drivers and witnesses. Record your
            reasoning and export the original files with their integrity
            manifest.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/intact">View connected journey</Link>
          <button className={styles.secondary} onClick={refresh}>
            Refresh evidence
          </button>
        </div>
      </header>
      <div className={styles.disclaimer}>
        Shared demo workspace. Use test material only. Pixie organizes evidence;
        the insurer determines fault, coverage, and claim outcomes.
      </div>
      {error ? (
        <div role="alert" className={styles.error}>
          {error} <button onClick={refresh}>Retry</button>
        </div>
      ) : null}
      <div className={`${styles.workspace} ${expanded ? styles.expanded : ""}`}>
        <aside className={styles.queue}>
          <div className={styles.queueHead}>
            <h2>Incident queue</h2>
            <span>{reports.length}</span>
          </div>
          <label className={styles.label}>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Location or reference"
            />
          </label>
          <label className={styles.label}>
            Status
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All incidents</option>
              <option value="open">Open</option>
              <option value="reviewing">In review</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          {!loaded ? (
            <div
              className={styles.skeleton}
              aria-label="Loading incident queue"
            />
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                className={`${styles.queueItem} ${selected === r.id ? styles.selected : ""}`}
                onClick={() => {
                  setSelected(r.id);
                  setNote("");
                }}
              >
                <span className={styles.eyebrow}>
                  {r.id} · {r.status}
                </span>
                <strong>{r.address}</strong>
                <span>
                  {r.counts.submitted} perspectives · {r.counts.pending} pending
                </span>
                <small>{time(r.happenedAt)}</small>
              </button>
            ))
          )}
          {loaded && !filtered.length ? (
            <p className={styles.note}>
              No matching incidents. Create one from Auto → Help → Road help in
              the Expo app.
            </p>
          ) : null}
        </aside>
        <section className={styles.detail}>
          {!incident ? (
            <div className={styles.empty}>
              <span className={styles.eyebrow}>
                Driver → witness → reviewer
              </span>
              <h2>Select an incident to review its perspectives.</h2>
              <p>
                New reports and contributions arrive here from the Expo app.
                Review status travels back to the same record on the phone.
              </p>
              <div className={styles.steps}>
                <div>
                  <b>01</b>
                  <p>A driver records the place, time and what happened.</p>
                </div>
                <div>
                  <b>02</b>
                  <p>A witness shares relevant footage with permission.</p>
                </div>
                <div>
                  <b>03</b>
                  <p>
                    A reviewer checks the files, records a decision and exports
                    the package.
                  </p>
                </div>
              </div>
              <p className={styles.note}>
                The workspace refreshes every eight seconds. It has no
                production insurer account integration.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.caseHeader}>
                <div>
                  <span className={styles.eyebrow}>
                    {incident.id} · {incident.status}
                  </span>
                  <h2>{incident.address}</h2>
                  <p>
                    {incident.kind} · {time(incident.happenedAt)}
                    <br />
                    {incident.vehicle || "Vehicle not recorded"}
                  </p>
                </div>
                <div className={styles.actions}>
                  <a
                    className={styles.primaryLink}
                    href={api.export(incident.id)}
                    download
                  >
                    Export evidence ZIP
                  </a>
                  <button
                    className={styles.secondary}
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? "Show queue" : "Focus on incident"}
                  </button>
                </div>
              </div>
              <div className={styles.summary}>
                <div>
                  <strong>{incident.counts.submitted}</strong>
                  <span>Submitted perspectives</span>
                </div>
                <div>
                  <strong>{incident.counts.accepted}</strong>
                  <span>Accepted for case review</span>
                </div>
                <div>
                  <strong>{incident.counts.pending}</strong>
                  <span>Awaiting review</span>
                </div>
                <div>
                  <strong>{incident.requestOpen ? "Open" : "Paused"}</strong>
                  <span>Witness request</span>
                </div>
              </div>
              <div className={styles.context}>
                <article>
                  <span className={styles.eyebrow}>Reporter statement</span>
                  <p>{incident.description || "No statement supplied."}</p>
                  <p className={styles.note}>
                    Reported facts, not a verified reconstruction.
                  </p>
                </article>
                {incident.lat !== null && incident.lng !== null ? (
                  <article>
                    <EvidenceMap lat={incident.lat} lng={incident.lng} />
                    <p className={styles.note}>
                      Reported scene: {incident.lat.toFixed(5)},{" "}
                      {incident.lng.toFixed(5)}. Cached map of the Toronto
                      example area.
                    </p>
                  </article>
                ) : (
                  <article>
                    <h3>Location gap</h3>
                    <p>
                      No scene coordinates were supplied. Review the written
                      address before comparing locations.
                    </p>
                  </article>
                )}
              </div>
              <h2 className={styles.sectionTitle}>Perspectives</h2>
              <div className={styles.files}>
                {incident.evidence.map((item) => (
                  <FileReview
                    key={item.id}
                    item={item}
                    incident={incident}
                    changed={changed}
                  />
                ))}
              </div>
              {!incident.evidence.length ? (
                <div className={styles.emptySmall}>
                  Waiting for footage. The driver can upload a file or open a
                  witness request in the app.
                </div>
              ) : null}
              <div className={styles.reviewPanel}>
                <h2>Case review</h2>
                <p>
                  Record the next action. Closing stops new contributions and
                  pauses witness requests. Reopening preserves the evidence
                  history.
                </p>
                <label className={styles.label}>
                  Case note
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={2000}
                    placeholder="What should happen next?"
                  />
                </label>
                <div className={styles.actions}>
                  {(["open", "reviewing", "closed"] as const).map((value) => (
                    <button
                      key={value}
                      className={styles.secondary}
                      disabled={
                        busy ||
                        note.trim().length < 3 ||
                        value === incident.status
                      }
                      onClick={() => status(value)}
                    >
                      {value === "open"
                        ? "Reopen incident"
                        : value === "reviewing"
                          ? "Mark in review"
                          : "Close incident"}
                    </button>
                  ))}
                </div>
              </div>
              <details className={styles.audit}>
                <summary>
                  Activity and review history · {incident.events.length} events
                </summary>
                {incident.events
                  .slice()
                  .reverse()
                  .map((event, i) => (
                    <div key={`${event.at}-${i}`}>
                      <time>{time(event.at)}</time>
                      <p>{event.text}</p>
                    </div>
                  ))}
              </details>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
