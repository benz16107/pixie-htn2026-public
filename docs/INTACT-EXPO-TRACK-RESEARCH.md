# Intact and Expo track research

Research checked on 2026-09-20. This note maps the public sponsor requirements to the current Pixie repository. It separates implemented behavior from browser-only checks, native work that still needs proof, and claims the Devpost story should avoid.

## Official Intact requirements

The official [Hack the North 2026 Devpost page](https://hackthenorth2026.devpost.com/) calls the track **"Intact: The Quoting Interface of the Future."** Eligibility requires a modern way to obtain car insurance, tenant insurance, or both through AI, such as a chatbot or agent.

Intact publishes five judging criteria:

1. Build a functional prototype that reimagines how people obtain car insurance, tenant insurance, or both.
2. Show a complete or partial quote experience in which the user supplies relevant information and receives a recommendation, estimate, or next step.
3. Prioritize user experience and accessibility through a clear, intuitive, inclusive interface.
4. Provide a short explanation or README that covers the problem, AI use, user journey, key features, assumptions, limits, and future improvements.
5. Build the work during the hackathon and ensure it is substantially the team's own work.

The public page does not require both insurance products, a bound policy, real carrier rates, a claim workflow, a particular model vendor, or a particular AI framework.

## Intact requirement-to-Pixie mapping

| Official requirement | Implemented proof | Honest boundary |
| --- | --- | --- |
| Modern car and/or tenant insurance experience through AI | Pixie has a consumer mobile experience plus a nine-tool MCP server that an AI client can use for tenant estimates, Auto estimates and comparisons, scenarios, driving explanations, application drafts, policy summaries, and recovery handoffs. [`server.py`](../mcp/src/pixie_mcp/server.py) defines the tool boundary, and [`test_server.py`](../mcp/tests/test_server.py) exercises the protocol. | The visible web MCP page chooses from preset tools. It proves a live MCP call, not autonomous tool planning. Say that the tools are available to AI agents. Do not claim the page itself is an autonomous AI agent. |
| Functional prototype for tenant insurance, Auto insurance, or both | The Expo app has Home, Compare, Insights, and Community tabs with a Home/Auto switch. Home covers inventory, a Toronto tenant estimate, coverage exploration, and recovery. Auto covers three example vehicles, budget comparison, Drive Score, and incident exchange. [`app/README.md`](../app/README.md) and [`EXPO.md`](EXPO.md) describe the current product. | Home pricing is tenant-only. Auto listings and rates are bundled examples. No displayed price is an Intact rate or offer. |
| User supplies relevant information and receives an estimate, recommendation, or next step | The tenant flow accepts an address, contents amount, unit level, claims, deductible, liability, sewer backup, and bundle choice. It returns an itemized annual and monthly estimate, decision, reasons, and next step. Auto accepts a vehicle and rating choices and returns an auditable illustrative estimate or advisor-review next step. [`consumer.py`](../api/src/atlas_api/consumer.py), [`test_consumer.py`](../api/tests/test_consumer.py), and [`test_tenant.py`](../api/tests/test_tenant.py) cover these contracts. | A cached tenant example cannot price arbitrary changed answers. The live API is needed for a changed tenant scenario. The app neither binds coverage nor submits an application. |
| Clear and intuitive user journey | The customer sees task names rather than the internal insurance architecture. Expo Router provides four labelled tabs and focused stack screens. Inventory totals can populate the contents amount. Coverage choices remain drafts until the customer saves them. Car comparison combines payment and insurance under one budget. [`_layout.tsx`](<../app/app/(lifecycle)/_layout.tsx>), [`home-inventory.tsx`](../app/app/home-inventory.tsx), and [`auto-compare.tsx`](../app/app/auto-compare.tsx) contain the flows. | Native iPhone and Android visual verification is still pending. Current responsive proof comes from browser widths of 320, 390, and 430 pixels. |
| Accessibility | The app uses labelled tabs, platform fonts and icons, at least 44-point product controls, native font scaling, reduced-motion handling, radio-group roles, progress semantics, labelled inputs, and live regions for status messages. [`EXPO.md`](EXPO.md), [`driving-context.tsx`](../app/app/driving-context.tsx), and [`recovery-plan.tsx`](../app/app/recovery-plan.tsx) record examples. | These code paths and browser checks support an accessibility claim, but they are not a formal WCAG audit or assistive-technology test on physical devices. |
| Explain the problem, AI, journey, features, assumptions, limits, and future work | The root [`README.md`](../README.md), mobile [`README.md`](../app/README.md), [`EXPO.md`](EXPO.md), [`TRACKS.md`](TRACKS.md), and the current Intact judging guide in [`02-intact.md`](../DEMO/tracks/02-intact.md) cover the requested topics. | The Devpost section should summarize this material directly. Judges should not need to reconstruct the Intact case from several documents. |
| Team-built during the hackathon | The public source and design assets can support this statement. | This is a team-authorship and timing assertion, not something the implementation can prove. The submitter must confirm it before publication. |

## The strongest honest Intact story

Pixie reframes insurance quoting as an ongoing customer journey. A tenant starts with the belongings they need to cover, enters their own replacement values, uses the total in a Toronto estimate, and sees the source and price effect of each choice. A car shopper compares the payment and a clearly labelled illustrative insurance estimate under one budget. The same app then supports prevention, driving coaching, and a safety-first recovery record.

AI belongs at the interaction boundary rather than inside the price calculation. An MCP-capable agent can choose a narrow Pixie tool and explain its sourced result. Typed code validates the inputs and calculates every estimate and score. The current web demo exposes the selected tool and arguments, but its choices are presets. The most precise Devpost wording is: **"Pixie exposes the same insurance calculations as narrow MCP tools that an AI agent can choose and explain."**

The quote itself is the clearest proof for Intact. Community evidence and Drive Score make the product broader, but they should follow the quote rather than replace it in the track story.

## Official Expo requirements

The official [Expo prize description on Devpost](https://hackthenorth2026.devpost.com/) asks teams to build a mobile app with Expo and React Native for native iOS and Android. Expo says it is looking for the best mobile experience: visually strong, native-feeling, and enjoyable to use.

The page names Expo Router, Expo UI, and `expo-widgets` as examples of tools teams may use. They are suggestions, not separate mandatory requirements or a weighted rubric.

The versioned Expo SDK 57 documentation confirms the relevant capabilities:

- [Expo Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/) provides file-based routing and native navigation components for iOS and Android. SDK 57 recommends `expo-router` `~57.0.22`, which matches Pixie's dependency.
- [Expo UI](https://docs.expo.dev/versions/v57.0.0/sdk/ui/) provides native Jetpack Compose and SwiftUI components. SDK 57 lists `@expo/ui` `~57.0.19` as included in Expo Go, which also matches Pixie's dependency.
- [`expo-widgets`](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/) creates iOS Home Screen widgets and Live Activities with Expo UI. SDK 57 recommends `~57.0.20`, which matches Pixie's dependency, and explicitly says the library is unavailable in Expo Go and needs a development build.

## Expo requirement-to-Pixie mapping

| Official concern | Implemented proof | Honest boundary |
| --- | --- | --- |
| Built with Expo and React Native | [`package.json`](../app/package.json) uses Expo SDK 57, React Native 0.86.3, Expo Router, and Expo first-party modules. [`app.json`](../app/app.json) configures iOS and Android applications. | The JavaScript bundles and public config pass. Physical-device checks remain unfinished. |
| Native iOS and Android experience | The app has shared React Native screens plus platform files for a SwiftUI drive button on iOS and a Jetpack Compose drive button on Android. [`DrivingNativeAction.ios.tsx`](../app/components/DrivingNativeAction.ios.tsx) and [`DrivingNativeAction.android.tsx`](../app/components/DrivingNativeAction.android.tsx) use `@expo/ui`. | Source implementation exists for both platforms. Do not claim both were tested on physical devices until that walkthrough happens. |
| Native-feeling navigation | Expo Router owns the stack, four labelled tabs, focused task screens, back navigation, and deep links. [`_layout.tsx`](../app/app/_layout.tsx) and [`_layout.tsx`](<../app/app/(lifecycle)/_layout.tsx>) are the route definitions. | Pixie uses the Router `Tabs` navigator, not Expo Router's newer `NativeTabs` API. Do not claim `NativeTabs`. |
| Expo UI | The main live-drive action has SwiftUI and Jetpack Compose implementations through `@expo/ui`. | Current project documentation says Expo UI requires a development build. That is inaccurate for SDK 57 because the official versioned page lists Expo UI as included in Expo Go. The development-build restriction applies to `expo-widgets`. |
| Widgets and Live Activities | [`driving-surfaces.ios.tsx`](../app/lib/driving-surfaces.ios.tsx) defines a Home Screen widget and Live Activity. The app config declares the widget extension and app group. The Drive Score screen publishes score, speed, area, and context. | `expo-widgets` is iOS-only and unavailable in Expo Go. The repository has in-app previews, but a signed development-build capture is still pending. Do not present a preview as a native widget or Live Activity. |
| Useful first-party Expo modules | Image Picker and File System support the local belongings inventory. Location supports address lookup and explicit foreground drives. Haptics confirms quote outcomes. Speech reads the itemized result. Print and Sharing create local estimate and recovery PDFs. Video plays incident clips. Web Browser opens an explicit advisor handoff. The uses are listed in [`EXPO.md`](EXPO.md) and implemented under [`app/`](../app). | Native camera capture, file handling, video playback, and share-sheet behavior still need a physical-device walkthrough after rebuilding the app with the current modules and permissions. |
| Enjoyable and visually strong | The product uses customer-task navigation, platform fonts and symbols, haptic feedback, skeleton loading, large touch targets, itemized receipts, visible privacy boundaries, and no route retention. The current browser verification found no horizontal overflow at 320, 390, or 430 pixels. | "Beautiful," "native-feeling," and "a joy to use" are judging goals, not facts established by unit tests. Final native screenshots and a short interaction video are the right proof. |

## Work still in flux

- Native iPhone and Android visual verification is pending. The current evidence includes TypeScript, public Expo config, browser flows, static web exports, and an iOS JavaScript/Hermes export, not a signed device build.
- The widget and Live Activity implementation is present, but native captures still depend on Apple signing, the development build, the app extension profile, and a compatible iPhone.
- The inventory and incident flows use the camera and photo/video library in code. Browser checks do not prove native capture or playback.
- The connected driver, witness, and insurer workflow needs the API and web service. It has no production authentication, push broadcast, device attestation, payment, or carrier integration.
- Community credits are demo bookkeeping for a one-time payment preview. They have no cash value, do not change the quoted premium, and have no insurer approval.
- The presentation and track guides contain several native-feature claims that must stay conditional until the signed app has been run and recorded.

## Claims to avoid

- Do not call any estimate an Intact quote, Intact price, Intact tariff, insurer recommendation, or insurer offer.
- Do not say Pixie supports homeowner insurance. Home pricing currently supports tenant insurance only.
- Do not imply the Auto listings or rates come from a live marketplace or insurer. They are bundled illustrative inputs.
- Do not say the mobile quote uses AI to calculate a premium. Deterministic code calculates the estimate.
- Do not call the preset MCP web page an autonomous AI agent. It sends a visible selected tool and arguments to the live MCP server.
- Do not say the app binds coverage, submits an insurance application, files a claim, approves coverage, or pays a witness.
- Do not claim automatic object recognition, appraisal, or cloud backup for the belongings inventory. Customers identify and value items, and native records are local app data.
- Do not describe a file hash as proof of authenticity, device identity, fault, or an independent perspective.
- Do not say Drive Score affects a quote or premium, stores a route, or tracks in the background. It is foreground coaching, with coarse points discarded by the service.
- Do not say the native widget or Live Activity has been demonstrated unless the final media comes from the signed development build.
- Do not say Expo UI requires a development build under SDK 57. Official SDK 57 documentation lists it as included in Expo Go. `expo-widgets` is the part that requires a development build.
- Do not claim the project uses Expo Router `NativeTabs`; it uses Router `Tabs`.
- Do not claim both iOS and Android device testing until those checks have happened.

## Corrections for the Devpost draft

1. Make the quote journey the core Intact proof: user inputs, itemized estimate, recommendation or advisor next step, and visible limitations.
2. Describe AI as an agent-facing MCP layer over deterministic insurance tools. Add one sentence that the on-page demonstration uses preset tool choices.
3. Treat the Intact work-ownership criterion as a submitter confirmation, not an implementation claim.
4. For Expo, describe Router, Expo UI, first-party device modules, and the configured widget extension. Keep the native widget and Live Activity conditional until real captures exist.
5. Correct any statement that Expo UI itself requires a development build. SDK 57 includes Expo UI in Expo Go. Only the widget extension and Live Activity need the development build in this story.
6. Do not use module count as the Expo argument. Explain how each module shortens a customer task or moves information to an appropriate native surface.

## Verification

The following checks passed on 2026-09-20:

```text
api: 14 consumer, driving, and tenant tests passed
mcp: 6 protocol and tool-boundary tests passed
app: TypeScript passed
app: 4 inventory tests passed
app: 4 witness-reward tests passed
app: Expo public config generated successfully
```

Repository verification records add browser checks for the quote, inventory, Auto budget, community savings, and connected evidence loop. They explicitly state that native camera, video, widget, and physical-device proof remains pending. See [`2026-09-20-mobile-discovery.json`](../DEMO/verification/2026-09-20-mobile-discovery.json), [`2026-09-20-road-help.json`](../DEMO/verification/2026-09-20-road-help.json), and [`2026-09-20-community-savings.json`](../DEMO/verification/2026-09-20-community-savings.json).
