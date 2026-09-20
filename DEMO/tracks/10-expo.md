# Expo: asynchronous judging guide

[All tracks](../4-PER-TRACK.md) · [Recovery](../5-IF-IT-BREAKS.md) · [Implementation notes](../../docs/EXPO.md)

## The pitch

"Pixie uses Expo to put a complete Home and Auto insurance companion on the phone. Customers can estimate coverage, compare choices, improve preparedness, measure a private Drive Score, and organize help after an incident."

Keep the phone on screen for most of the submission. The web diagram provides ten seconds of context. The mobile app provides the proof.

## What to show

| Expo capability | Working proof | Why it belongs in the product |
| --- | --- | --- |
| Expo Router | Home, Compare, Insights, Community tabs and focused task screens | Customers can reach the next insurance task without learning the internal lifecycle model |
| Expo Image Picker | Photograph or choose a belonging photo | Turns home intake into a concrete item-by-item task |
| Expo File System | Save the inventory and copied photos in native app storage | Records survive reopening the app without uploading personal photos |
| Expo Location | Address lookup and foreground Drive Score | One permission supports faster intake and live driving measurements |
| Expo UI | Native SwiftUI or Jetpack Compose drive action | The most important live action uses the platform control system |
| `expo-widgets` | iOS widget and Live Activity | Score, speed, and road context remain visible outside the app |
| Haptics | Coverage choices and result feedback | Changes have native confirmation |
| Speech | Spoken tenant-estimate summary | The itemized result has a hands-free review path |
| Print and Sharing | Estimate and recovery-plan PDFs | Customers can keep or discuss the same record |
| Web Browser | Advisor handoff | Leaving the app is an explicit customer choice |

## Two-minute video

| Time | Action | Script |
| ---: | --- | --- |
| 0:00 to 0:12 | Open the phone on Home. Switch once between My place and My vehicle. | "Pixie is one consumer app for Home and Auto insurance. Its tabs are customer tasks: Home, Compare, Insights, and Community." |
| 0:12 to 0:34 | Open the three-vehicle comparison. | "Before I buy a car, I can compare its monthly payment with an illustrative insurance estimate under the same driver profile." |
| 0:34 to 1:08 | Open Insights, then Drive Score. Run the Toronto sample. | "Drive Score reads foreground GPS speed, derives speeding and hard-brake events, and asks a stateless service to classify coarse road context. Driving behavior and road conditions remain separate and visible." |
| 1:08 to 1:23 | Hold on the widget and Live Activity previews, then show native captures if available. | "Expo publishes the same score, speed, and area to a Home Screen widget and Live Activity in the iOS development build." |
| 1:23 to 1:42 | Switch to Home and show the tenant estimate receipt. Play its spoken summary and open Share. | "Home has a working Toronto tenant estimate. Expo Speech, Print, and Sharing reuse the exact itemized receipt." |
| 1:42 to 1:58 | Open Community and create a recovery plan. | "After an incident, Pixie starts with safety and creates a local record. The customer decides whether to save or share it." |
| 1:58 to 2:08 | End on the Drive Score privacy card. | "Tracking runs only during the foreground drive. No route is stored, and the coaching score cannot change the premium." |

## Screenshot order

1. Consumer Home with My vehicle selected.
2. Three-car comparison with visible illustrative-estimate badges.
3. Active Drive Score with behavior and road-context results.
4. Widget and Live Activity, captured from the development build when available.
5. Tenant receipt with Listen and Share actions.
6. Ready recovery plan.

## Required disclosure

"The widget, Live Activity, SwiftUI, and Jetpack Compose components require native development builds and do not run in Expo Go. Vehicle listings and Auto estimates are illustrative. Drive Score is coaching only, stores no route, and cannot change a quote or premium. Home pricing currently supports tenant insurance."

If Apple signing is unavailable, show the on-screen widget and Live Activity previews and describe them as previews. Do not claim that Expo Go ran a native extension.

## Discovery demo additions

Show **Home → Your belongings** to capture an item and replacement value. Save, reopen, and show the same record. On web, use the photo-library picker; on a phone, **Take photo** requests camera permission only when tapped. The app never asks for microphone access for this flow.

Use the inventory total in a tenant estimate, then open **Compare → Explore my price**. Move the contents slider or choose a deductible. The estimate and monthly difference stay visible in the footer. A separate repair-bill example explains the deductible without promising a claim payment.

For Auto, **Compare cars** now includes a monthly budget slider, precise plus/minus controls, and a payment-versus-insurance bar for each vehicle. The listings and prices remain illustrative.

Web checks verify photo persistence, editing, deletion, price updates, and budgeting. The iOS JavaScript bundle exports successfully. A physical iPhone camera and native file-storage walkthrough still need verification in the rebuilt development app. Do not present browser screenshots as native camera proof.

## Connected driver and witness recovery

The mobile app now includes Incident exchange for both drivers and bystanders. The website adds an **Insurer** tab under Intact. Demonstrate a driver report, a witness upload, a reviewer decision, and the status returning to the phone. Follow the [road-help script](../10-ROAD-HELP.md). Expo Image Picker handles photos and clips, Expo Video plays the evidence, and the existing recovery plan carries the incident reference. Credits are demo bookkeeping; file hashes do not establish authenticity or fault.

## Witness incentive to demonstrate

Open Community on either Home or Auto, then **I witnessed an incident**. Each request states its offered demo credit. A submitted file waits for review before it earns anything. Accept it in the insurer workspace, then show the witness Home screen: the shared credit is split between Home and Auto. In Compare, move all of it to Auto and show the simulated next-payment reduction. The credit is one-time, not a recurring premium discount; no real insurer has approved this program. See [the connected walkthrough](../10-ROAD-HELP.md).

## Native widget rehearsal

If the widget displays a red "No layout found" block, reload the installed Pixie development project from port 8081. The fix registers layouts on app startup and corrects the iOS adapter resolution. Run the Toronto sample in Drive score, leave it running, and record the Home Screen widget and Lock Screen Live Activity. The screen now reports native errors and offers a retry. Follow the [device walkthrough](../../docs/EXPO.md#recover-a-blank-red-widget). On September 20, the user completed this check and confirmed that both native views display. Capture those views from the iPhone for the submission.
