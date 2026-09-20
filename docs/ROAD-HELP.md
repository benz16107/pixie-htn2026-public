# Connected road evidence

Incident exchange brings the driver and bystander workflows into Pixie's Expo app. The Intact insurer workspace reviews those same records. The customer can carry the incident reference and a snapshot of its evidence status into the existing recovery plan.

## Where to open it

- Phone: Auto → Community → **I was in an incident** or **I witnessed an incident**. Insights also links to witness requests.
- Mobile browser: `http://macserver:8081/road-help`.
- Intact insurer workspace: `http://macserver:3100/intact/insurer`, or `http://localhost:3100/intact/insurer` on the server itself.
- Connected overview: `/intact`, with driver, witness, and insurer nodes under Recover.

The normal web build includes `/intact/insurer` beside Overview and Advisor desk. Both products use the same web server on port 3100 and API on port 8000. Replace `macserver` with your own reachable host when running elsewhere.

## Driver

1. Report the location, time, incident type, and your account of what happened. The current Auto vehicle fills the vehicle description.
2. Use current location, choose the Toronto example, or type an address. Coordinates remain unknown when only an address is supplied. On native phones, the map also supports correcting the incident point.
3. Choose your own footage or a witness request. Requests offer $1, $2, or $5 in demo credit per accepted contribution.
4. Confirm that you are safely stopped and approve sharing with the prototype workspace.
5. Upload a photo or video. The server calculates a SHA-256 hash and rejects identical files already in that incident.
6. Open or pause witness requests, review incoming perspectives, export the package, or create a linked recovery plan.

The reporter can delete a demo incident and its files after a second confirmation. Files otherwise remain in the local demo database; no automatic expiry is promised.

## Bystander

Switch to Bystander on Incident exchange. Browse open requests or use current location to find requests within five kilometres. This is a foreground lookup, not background tracking. **I wasn't there** hides a request on that device; Profile can restore dismissed requests.

Open a request, choose a photo or video, add a statement, and supply capture time or confirm scene coordinates only if known. Sharing requires explicit consent. The default anonymous option hides the contributor label, but does not redact the file, filename, or metadata.

My reports contains the customer's reports and contributions. Profile shows demo credits from accepted contributions and settings for the in-app request feed. Credits do not pay cash or alter the quoted premium. Home and Compare show a simulated one-time payment reduction. Customers allocate the shared credit to Home, Auto, or split it equally; a credit is never counted twice. A reporter cannot earn credits by contributing to their own incident. Reversing acceptance reverses the displayed credit; repeated acceptance does not multiply it.

## Community savings

The tabs are Home, Compare, Insights, and Community. Community exposes the bystander entry for both Home and Auto customers. Accepted witness contributions, rather than merely submitting a report, earn the amount offered by the request when the file was submitted.

Home shows the earned balance, pending amount, and separate Home and Auto allocations. Compare and Explore your price let the customer move that balance between products. Where an estimate exists, the next-payment preview subtracts the one-time allocation, stops at zero, and shows any unused credit. The underlying premium and driving score stay unchanged. These are prototype credits, not an insurer-approved program.

The allocation persists on this device. Accepted amounts are refreshed from the evidence service every eight seconds while the app is active. If the service is unavailable, savings show as unavailable rather than treating stale records as current.

## Insurer

The insurer tab has a searchable queue with Open, In review, and Closed filters. Selecting an incident shows the reporter's account, scene location, perspectives, and evidence gaps. Reviewers can play clips, inspect photos, compare declared capture times and coordinates, inspect file hashes, and accept, reject, or reopen each contribution with a required note.

Acceptance means accepted for case review. It is not a finding of fault or authenticity. Case notes can move an incident into review, close it to new contributions, or reopen it. Closing pauses witness requests; reopening does not silently restart them.

Export downloads a ZIP with the original uploaded bytes, `manifest.json`, and an explanation of the evidence checks. The manifest contains the hash of each file and the review history. Video responses support byte ranges for playback and seeking.

## Honest checks

| Item | What Pixie actually does |
| --- | --- |
| File integrity | Hashes the bytes received and includes the same hashes in the export |
| Duplicate detection | Rejects an identical hash within the same incident |
| Capture time | Shows contributor-declared time and its difference from reported incident time; otherwise unknown |
| Location | Computes distance between declared capture coordinates and the reported scene; otherwise unknown |
| Device identity | Not verified |
| Authenticity and independent perspectives | Not established by a hash, a role label, or multiple uploads |
| Fault, coverage, claim payment | Reserved for the insurer; not calculated here |
| Notifications and rewards | In-app requests and demo credit bookkeeping, with no push or payment service |

## Repeatable example

Use **Try an illustrated example** at the bottom of Incident exchange. It creates one repeatable example for the local role and device, with two clearly labelled scene diagrams. Their hashes are real; the pictures are illustrations, not camera evidence. Capture time and capture location stay unknown. Example attachments never earn credits.

For the full contribution demo, use two devices or two browser profiles: one driver and one witness. Switching roles on the same device does not create an independent person or qualify the reporter for credits on their own case.

## Implementation and limits

- SQLite stores incidents, evidence metadata, review events, and file bytes in `var/evidence.sqlite`, which is ignored by Git. Set `PIXIE_EVIDENCE_DB` for an isolated database.
- `api/src/atlas_api/evidence_routes.py` owns validation, atomic database updates, integrity checks, reviews, exports, and examples.
- `shared/evidence.ts` is the typed client contract used by both Expo and Next.js. Both bundlers include this shared folder.
- Expo Image Picker provides camera photos and library photo/video selection. Expo Video provides in-app clip playback. Expo File System stores the local demo identity and preferences on native devices; the browser uses local storage.
- The two clients refresh evidence every eight seconds. They show service failures without inventing a successful upload or review.
- Cached OpenStreetMap tiles keep the Toronto scene visible without a network request. Locations outside the cache show coordinates with an explicit map gap on web. Native map selection uses the platform map.
- The workspace has no production authentication, signed device attestations, media redaction, background proximity service, or insurer integration. Use test material only. The current MCP recovery-handoff tool remains separate; it does not expose these uploaded files.
- Uploads accept PNG, JPEG, WebP, MP4, MOV, and WebM, up to 12 MB. Native video playback needs the updated app binary when using a development build.

## Verification

The automated browser walkthrough used separate driver and witness contexts, uploaded two files, accepted a contribution in the insurer desk, observed status and credit updates on mobile, downloaded the ZIP, and opened a linked recovery plan. It checked widths of 320, 390, and 430 pixels with no horizontal overflow or page errors. ZIP contents matched the recorded hashes.

API tests cover unknown metadata, duplicate uploads including concurrent requests, byte-range responses, consent, file-type validation, role restrictions, closed requests, credit reversals, repeatable examples, and deletion. Native camera capture and playback still need a physical-device walkthrough.
