# Pixie consumer app

The Expo app is Pixie's Intact experience. Its tabs are Home, Compare, Insights and Community, with a shared Home/Auto switch. See the [mobile walkthrough](../docs/EXPO.md) and [incident exchange guide](../docs/ROAD-HELP.md).

## Start

From this directory:

```bash
npm ci
npx expo start --lan --port 8081
```

Create `app/.env.local` with the URLs your phone can reach:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_SERVER_IP:8000
EXPO_PUBLIC_WEB_URL=http://YOUR_SERVER_IP:3100
```

Replace `YOUR_SERVER_IP` with the API host's LAN or Tailscale address. A physical phone's `localhost` points to the phone. Reload the app after changing these values. All `EXPO_PUBLIC_` values are bundled into the client, so they must not contain secrets.

Keep `../shared/` beside this directory. The evidence contract and road-map assets are shared with Next.js.

## What needs a connection

The API supports tenant estimates, price exploration and the shared driver/witness/insurer workflow. Photo inventory is stored on the device. Bundled tenant examples, synthetic Auto calculations and the drive sample provide labelled fallbacks; they do not replace a live upload or insurer review. The Home price explorer cannot save a stale offline price.

The reviewer opens `/intact/insurer` on the web app. Driver reports and accepted witness contributions use the same local evidence database. Demo credits apply once to a payment preview, never to the quoted premium. Use two devices or browser profiles to demonstrate a driver and a separate witness.

## Native surfaces

Expo Go and the browser preview cover the shared foreground flow. Native widgets, Live Activities and Expo UI require a development build. The repository is configured for `@benz16107/pixie`; another developer needs the relevant Expo project access and platform signing credentials. A clone does not inherit the author's login.

Follow [native build instructions](../docs/EXPO.md#run-it). Camera capture, native playback and widgets still need physical-device verification; web checks do not establish that they work on a signed phone build.

## Checks

```bash
npx tsc --noEmit
npm run test:inventory
npx expo config --type public
```

Home pricing is renter/tenant-only. Auto prices, route context and witness credits are illustrative, with no Intact offer, real payout or claim submission.
