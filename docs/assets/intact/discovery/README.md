# Insurance discovery on the phone

Captured September 20, 2026 from the running Expo web app at a 390 × 844 viewport. These are browser captures of the React Native customer screens, not physical iPhone captures. Item names and values are test data; the four furnished-room items are labelled examples in the app.

| Screen | What the customer can do |
| --- | --- |
| [Belongings](inventory.png) | Record photos and values, see room totals, and use the total in a tenant estimate |
| [Coverage explorer](coverage.png) | Change coverage and compare the monthly result with the saved setup |
| [Car budget](car-budget.png) | Compare a monthly budget with each example car payment plus insurance |

The explorer's fixed footer keeps the price and difference visible while scrolling. Further down, a repair-bill control explains the deductible. Photos are supplied by the customer, not identified by a model. Prices are illustrative, not offers of insurance.

Verified through browser interaction: photo upload and persistence after reload, editing, deletion, invalid amount handling, storage failure messages, inventory-to-quote handoff, price changes, saved deductible, offline price blocking and retry, reset, budget buttons and touch slider, and overflow checks at 320, 390, and 430 pixels. Native camera and device file storage require a separate physical-device check.
