# Intact video script, first draft

The completed 4:27 narrated walkthrough is documented in [the rendered-video guide](12-INTACT-NARRATED-VIDEO.md). [Watch it here](http://macserver:3223/). The three-minute outline below is the earlier draft.

Target length: about three minutes, including pauses and cuts. This is an editing target, not a claimed submission limit. Check the final Devpost requirements before exporting.

Open [the Intact presentation](http://macserver:3112/intact/present). This is a website slideshow for recording and for judges to explore. The Expo app stays a consumer app.

The deck uses the Federato deck's slide/demo switch, remembered position, and keyboard navigation, with Pixie's warm consumer palette. Actual product captures accompany the script. Capture the final video at 1920 × 1080; record the phone separately and cut to a readable close-up rather than filming a tiny phone beside the browser.

## Recording controls

- Left/Right or Space moves between slides. Home/End jumps to the beginning/end.
- N opens the narration and shot list. Close it before recording.
- R toggles the clean recording view. Escape restores controls or returns to the demo.
- P switches between slides and the Intact demo. When opened as an overlay, the underlying demo stays mounted.
- Open demo uses the current slide's working route. Phone routes open the Expo browser preview in another tab, which is a rehearsal aid. Record the actual iPhone separately for the final video.
- Slide links preserve the chapter in the URL. There is no automatic advance; pause for the phone footage.

## Before recording

Keep API port 8000 and Expo port 8081 available. Start the MCP HTTP server on 8010 for the agent segment. Use a driver browser profile and a separate witness profile. Upload one labelled illustration, leave it pending, and have its insurer review ready. Do not use a real person's claim or personal footage.

The static slideshow works without those services. Its screenshots are captured product examples, not live embeds. The user confirmed on September 20 that both the native Home Screen widget and Lock Screen Live Activity display after the fix. Use real iPhone footage for this scene. If native footage is unavailable, use the labelled previews and change the narration to say previews. Do not imply continuous background tracking.

## 1. One app · 0:00 to 0:15

**Say**

When I am shopping for a car or moving into a new place, I want to understand insurance before I commit. Pixie brings estimates, choices, prevention, and recovery into one consumer app.

**Show**

- Open on this slide for five seconds, then cut to the phone Home screen.
- Switch Home to Auto once. Keep the recording close enough to read.

**Keep accurate**

All prices are illustrative. Home pricing currently covers tenants.

## 2. Your home · 0:15 to 0:40

**Say**

For home insurance, start with what you own. I can photograph belongings, enter their replacement values, and use the total instead of guessing a coverage amount. Then I add an address and a few coverage details to get an itemized tenant estimate.

**Show**

- Show this slide briefly, then record Home → Your belongings.
- Use Try a furnished-room example, or add your own demonstration photo and value.
- Show the room total and Use this total in my estimate.

**Keep accurate**

Values are entered by the customer. There is no automatic object recognition or appraisal.

## 3. Your choices · 0:40 to 1:05

**Say**

A price alone does not explain a policy. Here I can change my deductible and see the estimate respond. The repair-bill example explains what that deductible means in dollars. My existing choices stay unchanged until I save. Every price factor keeps its source.

**Show**

- On the phone choose a Toronto example address, then open Explore price changes first.
- Change the deductible once. Pause on the new monthly estimate.
- Scroll to Try a repair bill and show the customer share.

**Keep accurate**

Keep the API connected for changed tenant inputs. A repair-bill example is arithmetic, not a claim payment promise.

## 4. Your car · 1:05 to 1:25

**Say**

For auto, I want to compare insurance before buying the car. Pixie puts the car payment and an illustrative insurance estimate together, then shows which of three example vehicles fits my monthly budget. The same driver profile makes the comparison consistent.

**Show**

- Switch the phone to Auto and open Compare cars.
- Move the monthly budget slider once and pause on the vehicles that fit.

**Keep accurate**

These are bundled example listings, not a live AutoTrader integration or insurer quotes.

## 5. Your drive · 1:25 to 1:50

**Say**

The experience continues after the estimate. During an opt-in drive, Pixie measures speed changes and hard braking. It evaluates road context separately, so a demanding route is not confused with driving behaviour. The score is coaching only. The iPhone widget and Live Activity keep the latest drive score visible.

**Show**

- Open Auto → Insights → Drive score and run the Toronto sample.
- Show Driving and Road context separately.
- In the installed Pixie development app, reload the project from port 8081, then open Drive score and choose Preview with a Toronto sample.
- Leave that drive running. Go to the Home Screen for the widget, then lock the phone for the Live Activity. Finish the drive only after capturing both.
- Use real native footage only if both display correctly. Otherwise show the labelled in-app previews.

**Keep accurate**

Current GPS tracking is foreground-only. Widgets require a signed native build; do not present the in-app preview as native proof.

## 6. Your community · 1:50 to 2:25

**Say**

After an incident, the driver can record what happened and request another perspective. A bystander can contribute a photo or clip. The insurer reviews those same files, with their hashes and declared metadata. Accepted witness contributions earn a simulated credit. Here, two dollars can go toward Home, Auto, or a split. It is one shared balance, and no real insurer discount is connected.

**Show**

- Cut to the phone Community screen, then the driver incident with an open witness request.
- Use a separate witness device or browser profile to show the contributed file.
- Cut to the web Insurer tab, accept the file with a note, then cut back to witness Home or Compare.
- Move the credit to Auto. Show the before, credit, and simulated next-payment rows.

**Keep accurate**

Use illustrated or consented test material. A hash proves byte integrity, not authenticity or fault. Pending uploads earn no credit.

## 7. Your agent · 2:25 to 2:45

**Say**

Insurance questions can start in an AI conversation. With Pixie connected through MCP, the agent can compare cars or request a tenant estimate. Here is the actual tool request and its sourced answer. Pixie calculates the price; the agent explains it.

**Show**

- For seconds 0 to 4, hold the slide and name the customer question: tenant insurance before moving.
- For seconds 4 to 12, open the MCP demo, choose Tenant estimate, change contents to $50,000, and click Run live agent request.
- For seconds 12 to 20, hold on the returned price and source lines. The web page is a tool inspector, not an AI chat.
- If an external agent is connected, replace the first four seconds with the real prompt below and its visible Pixie tool call. Keep the successful response in the take.

**Keep accurate**

The web demonstration selects a preset tool; it is not an autonomous planning agent. No full customer profile is exposed.

## 8. The result · 2:45 to 3:00

**Say**

Pixie makes insurance easier to explore and easier to understand. The phone helps the customer take the next step. The insurer gets the evidence. And the same controlled tools remain available through an agent.

**Show**

- Return to this slide. Leave it on screen for the closing sentence.
- Keep the prototype limitations visible for the final three seconds.

**Keep accurate**

Tenant Home pricing only. Auto examples and credits are illustrative. No real policy binding or claim submission.

## Edit and submission notes

Use the slides for the opening idea and transitions. Most of the runtime should show a real interaction. Narration explains why the action matters; do not read every button. Keep the cursor still during a cut to the phone. Use the displayed values from your take rather than reciting a hardcoded quote.

For the gallery, capture the opening, inventory, price-choice, witness-credit, and MCP slides in recording view. Add real native widget evidence only after verifying it on an iPhone. Caption all examples as prototype data. The current captures and their provenance are listed in `web/public/intact/presentation/README.md`.

Narration and recording cues also live in `web/src/app/intact/present/slides.ts`. Update both when revising this draft.


## Connect an actual agent for the MCP scene

MCP lets an AI client discover and call Pixie's tools. It does not automatically give the client your phone profile, location, or insurance history. Give it demonstration inputs in the prompt. The client selects a tool, Pixie validates those inputs and computes a result, then the client can explain the returned values.

The quickest recording route is [the working tool inspector](http://macserver:3112/intact/agent). It calls the real MCP server, but you select its tool using a preset. This is enough to demonstrate the integration without pretending a chat happened.

For Codex on macserver, register the local server once:

```bash
codex mcp add pixie-insurance -- /Users/ben/.local/bin/uv --directory /Users/ben/Code/hackathons/htn-2026/atlas/mcp run pixie-mcp
codex mcp list
```

Open a new Codex session after adding the server. On the laptop, connect to the running macserver HTTP service instead:

```bash
codex mcp add pixie-insurance --url http://macserver:8010/mcp
```

Use one setup or the other. The HTTP option requires network access to macserver and the MCP service to remain running. Neither setup requires the Expo app to be open. The local stdio option starts its own server process.

Paste this prompt into the connected agent:

> Use Pixie's estimate_home_quote tool for a tenant at 180 Queen St W, Toronto, in an upper-floor unit. Use $50,000 contents, a $1,000 deductible, $1 million liability, no recent claims, no sewer-backup add-on, and no auto bundle. Explain the monthly estimate and the sources of its price factors. Clearly label it illustrative. Do not prepare an application.

For a car-shopping take:

> Use Pixie's compare_vehicles tool to compare all the bundled example cars. Use 10,000 to 20,000 annual kilometres, driveway parking, a $1,000 deductible, and zero claims in five years. Show the illustrative monthly insurance estimates and explain which is lowest. These are demonstration listings, not live dealership prices.

Do not record setup commands in the main submission. Record the customer question, the tool call, and the answer. If the client fails to connect, use the working web inspector and call it a preset tool demonstration.

## Production draft and capture plan

Create a 1920 by 1080, three-minute product walkthrough using the eight chapters above. Keep the current ivory and forest palette. Use the existing slides for chapter transitions, actual app interactions for the proof, and short captions that repeat the customer benefit. Record narration at a measured pace and leave room to read the results. Do not add unmeasured performance claims or invented customer testimonials.

| Scene | Capture source | Editing cue |
| --- | --- | --- |
| Opening | Website presentation, then phone Home | Start with the shopping or moving question. Show Home and Auto. |
| Belongings | Phone inventory | Keep the entered value and calculated total readable. |
| Choices | Phone coverage explorer | Hold the changed deductible and new estimate in the same shot. |
| Cars | Phone comparison | Show one budget change, then pause. |
| Drive | Phone sample, real Home Screen and Lock Screen | Label the sample. Do not substitute an in-app drawing for native footage. |
| Community | Driver and witness app, then insurer website | Cut on the same incident reference so the connection is visible. |
| Agent | Actual agent client or web MCP inspector | Show inputs, successful request, and sourced response. |
| Closing | Website presentation | Hold the prototype scope long enough to read. |

Browser footage can be captured and edited on macserver. This machine currently has no iOS Simulator because it has Command Line Tools rather than full Xcode. Native Home Screen and Lock Screen footage must come from the iPhone or a Mac with Xcode. A browser-sized phone view is useful for a draft, but it is not evidence that the iOS extension ran. The finished narrated video uses labelled Expo browser footage; see the rendered-video guide above.

A silent [MCP browser take](../docs/assets/intact/video/mcp-inspector.webm) is available as source footage. It records successful tenant and car-comparison requests. It is not the finished narrated video.
