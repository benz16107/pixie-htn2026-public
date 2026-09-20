# Expo mobile experience

Pixie is a consumer insurance app for Home and Auto. The phone does not expose the presentation framework used on the website. Customers see four everyday destinations: Home, Compare, Insights, and Community. A Home and Auto switch changes the tools and policy context without moving the customer into a second app.

## Consumer interface

The September 20 refresh follows Apple's guidance on [typography](https://developer.apple.com/design/human-interface-guidelines/typography) and [tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars). It uses platform system fonts, grouped ivory cards over a warm neutral background, one forest-green action color, labelled tabs, and a Home/Auto segmented control. Large titles identify the current task. Supporting screens keep the standard stack back button.

Icons use SF Symbols through `expo-symbols` on iOS and vector paths on web and Android. Emoji and character-based navigation icons have been removed. Buttons and product controls have at least 44-point touch targets, text retains native font scaling, and press feedback respects reduced motion.

The latest [phone-size screenshots](assets/intact/community/README.md) show Home, Compare, and Community with the warm palette and witness savings. The [earlier Apple-style pass](assets/intact/apple-refresh/README.md) also covers the driving screens. The refresh passed TypeScript, Expo Doctor, web export, tenant-estimate and recovery-plan browser flows, and layout checks at 320, 390, and 430 pixels. Native iPhone visual verification remains pending because the device host was unavailable.

## What works

Home includes the complete Toronto tenant estimate. A customer can enter an address or use location, inspect the neighbourhood data used by the model, confirm coverage, receive an itemized estimate, listen to the result, and save or share a PDF. The photo inventory records real belongings, customer-entered replacement values, and room totals. It persists on the device and can fill the contents amount for an estimate. Home pricing currently covers tenant insurance only.

Auto compares three illustrative vehicle listings with the same driver profile. Compare opens a live price explorer for distance, parking, deductible, contents, or liability. Draft changes stay separate until the customer saves them. A monthly car-and-insurance budget slider shows which illustrative vehicles fit. Insights contains prevention tasks and Drive Score. Community creates a private recovery checklist and a local PDF after an incident.

## Drive Score

Drive Score uses `Location.watchPositionAsync` after the customer taps **Start a live drive**. The app reads foreground GPS speed and calculates speed from distance and time when the device does not supply it. It counts a speeding event when the observed speed crosses the selected road-context threshold. It counts a hard brake when speed falls by at least 12 km/h within five seconds from a starting speed of at least 25 km/h.

The app rounds coordinates to three decimal places and sends at most 50 points to the stateless driving service. The service returns two scores:

- Driving behavior, based on aggregate speeding and hard-brake events.
- Road context, based on coarse examples such as a school approach, dense downtown streets, or a controlled-access corridor.

The displayed coaching score weights behavior at 75% and road context at 25%. It cannot change an insurance estimate or premium. The service stores no route and returns no coordinates. Tracking stops when the customer finishes the drive or leaves the screen.

The **Preview with a Toronto sample** action runs the complete screen while the phone is stationary. It is the reliable judging path when a real drive is impractical.

## Widget and Live Activity

The Drive Score screen contains faithful previews of both native surfaces. A development build publishes the same score, current speed, area, and road context through `expo-widgets`.

The Home Screen widget supports small and medium sizes. Add it by long-pressing the iPhone Home Screen, opening the widget picker, searching for Pixie, and choosing a size.

The Live Activity starts when a drive begins. It appears on the Lock Screen and, on supported iPhones, the Dynamic Island. It updates with the current score, speed, and area, then ends when the customer finishes the drive. If it does not appear, enable Live Activities for Pixie in iOS Settings.

Expo Go cannot load the widget extension, Live Activity, SwiftUI, or Jetpack Compose components. These features require the Pixie development build.

## Expo services used

| Expo service | Product use |
| --- | --- |
| Expo Router | Home, Compare, Insights, Community tabs plus focused estimate, inventory, driving, and recovery screens |
| Expo Image Picker | Camera and photo-library input for belongings |
| Expo File System | Persistent inventory, copied photos, and local road-help preferences |
| Expo Video | Play submitted incident clips inside the consumer app |
| Expo Location | Address lookup and foreground Drive Score samples |
| Expo UI | Native SwiftUI and Jetpack Compose drive actions |
| `expo-widgets` | iOS Home Screen widget and Live Activity |
| Expo Haptics | Feedback for quote choices and results |
| Expo Speech | Spoken tenant-estimate summary |
| Expo Print and Sharing | Itemized estimate and recovery-plan PDFs |
| Expo Web Browser | Explicit advisor handoff |
| Reanimated | Press feedback and reduced-motion handling |

## Run it

The app is configured for `@benz16107/pixie`; a fresh clone does not inherit an Expo login. Use an account with access to that project for its development builds. Set `EXPO_PUBLIC_API_URL` to an API URL the phone can reach. Follow [app setup](../app/README.md) for dependencies and environment files.

Use Expo Go for the React Native customer flow:

```bash
cd app
npx expo start --lan
```

Use a development build for the widget, Live Activity, and Expo UI components:

```bash
cd app
npx eas-cli device:create
npx eas-cli build --platform ios --profile development
npx expo start --dev-client --lan
```

EAS still needs private Apple Developer authentication and device registration. The `Pixie` app and `ExpoWidgetsTarget` extension need separate provisioning profiles. They can share one distribution certificate.

## Demo path

1. Open Auto from Home.
2. Open Insights, then Drive Score.
3. Tap **Preview with a Toronto sample** while stationary, or **Start a live drive** on a moving test device.
4. Point out current speed, distance, events, separate behavior and road-context scores, and the privacy boundary.
5. Show the widget and Live Activity previews. Replace those previews with captures from the development build once Apple signing is available.
6. Open Compare to change one assumption, then Community to build a recovery plan.

## Discover and choose coverage

The [discovery screenshots](assets/intact/discovery/README.md) show the added customer flows.

1. From Home, open **Your belongings**. Choose a photo or take one on a phone, name the item, select its room, and enter its replacement value. Save it. Reloading preserves the record. Use **Try a furnished-room example** for labelled sample belongings if you need a faster walkthrough.
2. Tap **Use $10,000 in my estimate**, or the amount shown for your inventory. The app rounds up to a $5,000 coverage step with a $10,000 minimum. Totals above $100,000 require an advisor; the app does not cap them silently. Choose a Toronto address and review coverage. The recorded contents amount survives address selection.
3. Open **Explore price changes first**, or use Compare → **Explore my price**. Change the deductible and watch the monthly difference in the fixed footer. The repair-bill example explains the amount up to the deductible and the remaining bill. Save choices to carry them back to the coverage form.
4. Switch to Auto, open **Compare cars**, and move the monthly budget. Each listing shows the car payment, insurance, total, and amount under or over the budget. The plus and minus controls also support precise changes.

Photos have no automatic object recognition. Customers identify and value each item. Native photos are copied into the app's documents directory; the browser preview stores small image data in local storage. This is device-local storage, not cloud backup or an encrypted insurance vault. Deleting app data removes the inventory. Only the chosen contents amount enters the estimate, not item photos.

The Home price explorer needs the live estimate service because the cached tenant examples do not price changed answers. It blocks saving a stale price when offline. Auto can calculate using its labelled bundled illustration. Neither flow binds coverage or submits an application. A signed native build must be rebuilt to include the new photo permission text and native modules.

## Connected road help

Auto → Community now includes driver reports and bystander contributions. Insights links to witness requests. Reports, files, review status, and demo credits share one API with the new Intact insurer tab. The recovery plan can import an incident reference and status snapshot. See the [full workflow and limits](ROAD-HELP.md) and [demo script](../DEMO/10-ROAD-HELP.md).

### Community savings

Home and Compare show accepted witness credits, a separate pending balance, and Home/Auto allocations. Compare and Explore your price let the customer choose Home, Auto, or an equal split. The next-payment preview subtracts the allocation once and never falls below zero. The quote itself stays unchanged. All credits are simulations without cash value or insurer approval. Community exposes witness requests for either product.

The shared community provider persists the local identity and allocation, then refreshes evidence while the app is active. Review reversals remove the credit. An unavailable service hides the savings calculation instead of showing a stale balance as current.

## Recover a blank red widget

The September 20 bug was a platform-resolution error. Metro loaded `driving-surfaces.ts`, the no-op adapter, before `driving-surfaces.ios.tsx`. Nothing registered the `DriveContext` layout, so the extension displayed "No layout found" and no Live Activity started. Both adapters now use the `.tsx` suffix. App startup registers the native layouts and seeds an idle widget without an invented score.

To load the fix on the already-installed development build:

1. Open the installed **Pixie** app and reload its development project from `http://macserver:8081`. Opening Expo Go does not load the native extension.
2. Open **Insights → Drive score**. The widget status should say that the widget is ready.
3. Choose **Preview with a Toronto sample**. The status should report that the Live Activity started, or display the actual native error with a retry button.
4. Return to the Home Screen. If the old red widget remains after the app reload, remove that widget and add **Pixie Drive Score** again. This asks iOS for a fresh snapshot.
5. Lock the iPhone while the sample drive remains active. The Live Activity belongs on the Lock Screen and supported Dynamic Island. Do not finish the drive or navigate away from the Drive score screen before recording it.
6. Return to Pixie and finish the drive. The Live Activity ends; the widget retains the latest score with speed zero.

These changes require fresh JavaScript, not a new native entitlement or another signing step. The development build must already contain `ExpoWidgets`. If the status says it is unavailable, check that you opened Pixie rather than Expo Go. If iOS refuses the activity, check Pixie's Live Activities setting and use the retry button.

The app records foreground GPS only. Locking the phone shows the latest published snapshot; it does not enable background tracking. iOS controls widget refresh timing, so the Home Screen is not a second-by-second speedometer.

Verification: `cd app && npm run test:widgets` covers platform resolution, first-launch layout registration, preserving a stored timeline, Expo Go fallback, activity reuse, activity errors, stopping a drive, and compiling both layouts with the installed Expo Babel plugin. The served iOS bundle includes both native layout definitions. The user completed the iPhone walkthrough on September 20 and confirmed that both the widget and Live Activity now display.
