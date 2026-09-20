export type IntactSlide = {
  id: string; chapter: string; time: string; seconds: number; title: string; description: string; takeaway: string; visual: string; alt: string; caption: string; demo: string; demoLabel: string; phone?: boolean; narration: string; shots: string[]; limit: string;
};

export const intactSlides: IntactSlide[] = [
  {
    "id": "one-app",
    "chapter": "One app",
    "time": "0:00\u20130:15",
    "seconds": 15,
    "title": "Home and auto.\nOne place to start.",
    "description": "Get an estimate, explore your choices, and keep useful records after an incident.",
    "takeaway": "Quote \u00b7 Decide \u00b7 Protect \u00b7 Recover",
    "visual": "home",
    "alt": "The actual Pixie Home screen, with tenant insurance and community savings.",
    "caption": "Expo app \u00b7 Home",
    "demo": "/intact",
    "demoLabel": "Open the system diagram",
    "narration": "When I am shopping for a car or moving into a new place, I want to understand insurance before I commit. Pixie brings estimates, choices, prevention, and recovery into one consumer app.",
    "shots": [
      "Open on this slide for five seconds, then cut to the phone Home screen.",
      "Switch Home to Auto once. Keep the recording close enough to read."
    ],
    "limit": "All prices are illustrative. Home pricing currently covers tenants."
  },
  {
    "id": "belongings",
    "chapter": "Your home",
    "time": "0:15\u20130:40",
    "seconds": 25,
    "title": "Start with\nwhat you own.",
    "description": "Photograph belongings, add replacement values, and use the total in a tenant estimate.",
    "takeaway": "Your photos. Your values. A calculated coverage amount.",
    "visual": "inventory",
    "alt": "Pixie room inventory with labelled example belongings and customer-entered values.",
    "caption": "Expo app \u00b7 Room inventory example",
    "demo": "/home-inventory",
    "demoLabel": "Open room inventory",
    "phone": true,
    "narration": "For home insurance, start with what you own. I can photograph belongings, enter their replacement values, and use the total instead of guessing a coverage amount. Then I add an address and a few coverage details to get an itemized tenant estimate.",
    "shots": [
      "Show this slide briefly, then record Home \u2192 Your belongings.",
      "Use Try a furnished-room example, or add your own demonstration photo and value.",
      "Show the room total and Use this total in my estimate."
    ],
    "limit": "Values are entered by the customer. There is no automatic object recognition or appraisal."
  },
  {
    "id": "choices",
    "chapter": "Your choices",
    "time": "0:40\u20131:05",
    "seconds": 25,
    "title": "See what\na choice changes.",
    "description": "Try a deductible or coverage limit. Compare the price with your share of an example repair bill.",
    "takeaway": "Explore first. Save when you decide.",
    "visual": "coverage",
    "alt": "Pixie coverage explorer with an illustrative monthly estimate and editable coverage choices.",
    "caption": "Expo app \u00b7 Tenant price explorer",
    "demo": "/coverage-lab",
    "demoLabel": "Open the price explorer",
    "phone": true,
    "narration": "A price alone does not explain a policy. Here I can change my deductible and see the estimate respond. The repair-bill example explains what that deductible means in dollars. My existing choices stay unchanged until I save. Every price factor keeps its source.",
    "shots": [
      "On the phone choose a Toronto example address, then open Explore price changes first.",
      "Change the deductible once. Pause on the new monthly estimate.",
      "Scroll to Try a repair bill and show the customer share."
    ],
    "limit": "Keep the API connected for changed tenant inputs. A repair-bill example is arithmetic, not a claim payment promise."
  },
  {
    "id": "car",
    "chapter": "Your car",
    "time": "1:05\u20131:25",
    "seconds": 20,
    "title": "The payment is\nonly part of the cost.",
    "description": "Compare a car payment and its illustrative insurance estimate against one monthly budget.",
    "takeaway": "Three example cars. The same driver profile.",
    "visual": "cars",
    "alt": "Pixie compares three example vehicles with car payment, insurance, and a monthly budget.",
    "caption": "Expo app \u00b7 Illustrative vehicle comparison",
    "demo": "/auto-compare",
    "demoLabel": "Open vehicle comparison",
    "phone": true,
    "narration": "For auto, I want to compare insurance before buying the car. Pixie puts the car payment and an illustrative insurance estimate together, then shows which of three example vehicles fits my monthly budget. The same driver profile makes the comparison consistent.",
    "shots": [
      "Switch the phone to Auto and open Compare cars.",
      "Move the monthly budget slider once and pause on the vehicles that fit."
    ],
    "limit": "These are bundled example listings, not a live AutoTrader integration or insurer quotes."
  },
  {
    "id": "drive",
    "chapter": "Your drive",
    "time": "1:25\u20131:50",
    "seconds": 25,
    "title": "Understand your drive.\nUnderstand the road.",
    "description": "Driving behaviour and road context are shown separately in a coaching score.",
    "takeaway": "Foreground GPS \u00b7 Speed changes \u00b7 Road context",
    "visual": "drive",
    "alt": "Pixie Drive score showing a labelled sample trip and previews of the widget and Live Activity.",
    "caption": "Expo app \u00b7 Sample drive and native-surface previews",
    "demo": "/driving-context",
    "demoLabel": "Open Drive score",
    "phone": true,
    "narration": "The experience continues after the estimate. During an opt-in drive, Pixie measures speed changes and hard braking. It evaluates road context separately, so a demanding route is not confused with driving behaviour. The score is coaching only. The iPhone widget and Live Activity keep the latest drive score visible.",
    "shots": [
      "Open Auto \u2192 Insights \u2192 Drive score and run the Toronto sample.",
      "Show Driving and Road context separately.",
      "Reload the installed Pixie development app, run the Toronto sample, and leave it running while capturing the real Home Screen widget and Lock Screen Live Activity. Use labelled previews if native verification is incomplete."
    ],
    "limit": "Current GPS tracking is foreground-only. Widgets require a signed native build; do not present the in-app preview as native proof."
  },
  {
    "id": "witness",
    "chapter": "Your community",
    "time": "1:50\u20132:25",
    "seconds": 35,
    "title": "One incident.\nMore than one perspective.",
    "description": "A driver reports. A witness contributes. An insurer reviews the same evidence.",
    "takeaway": "Accepted witness evidence earns a simulated, one-time credit.",
    "visual": "savings",
    "alt": "Pixie shows a two-dollar accepted witness credit applied once to a simulated Auto payment.",
    "caption": "Expo app \u00b7 Accepted contribution savings simulation",
    "demo": "/intact/insurer",
    "demoLabel": "Open the insurer desk",
    "narration": "After an incident, the driver can record what happened and request another perspective. A bystander can contribute a photo or clip. The insurer reviews those same files, with their hashes and declared metadata. Accepted witness contributions earn a simulated credit. Here, two dollars can go toward Home, Auto, or a split. It is one shared balance, and no real insurer discount is connected.",
    "shots": [
      "Cut to the phone Community screen, then the driver incident with an open witness request.",
      "Use a separate witness device or browser profile to show the contributed file.",
      "Cut to the web Insurer tab, accept the file with a note, then cut back to witness Home or Compare.",
      "Move the credit to Auto. Show the before, credit, and simulated next-payment rows."
    ],
    "limit": "Use illustrated or consented test material. A hash proves byte integrity, not authenticity or fault. Pending uploads earn no credit."
  },
  {
    "id": "agent",
    "chapter": "Your agent",
    "time": "2:25\u20132:45",
    "seconds": 20,
    "title": "Ask through\nyour own AI agent.",
    "description": "MCP exposes the same estimate and comparison tools, with visible inputs and sourced results.",
    "takeaway": "The tool calculates the price. The agent can explain it.",
    "visual": "agent",
    "alt": "The real Pixie MCP demo with a selected tenant-estimate tool, arguments, and sourced result.",
    "caption": "Web app \u00b7 Preset request through the MCP service",
    "demo": "/intact/agent",
    "demoLabel": "Open the MCP demo",
    "narration": "Insurance questions can start in an AI conversation. With Pixie connected through MCP, the agent can compare cars or request a tenant estimate. Here is the actual tool request and its sourced answer. Pixie calculates the price; the agent explains it.",
    "shots": [
      "Show the customer question on the slide, then open the MCP tool inspector. An external-agent take can instead show the real prompt and tool call.",
      "Use Tenant estimate. Set contents to $50,000 and click Run live agent request.",
      "Hold the shot on the result and its source lines."
    ],
    "limit": "The web demonstration selects a preset tool; it is not an autonomous planning agent. No full customer profile is exposed."
  },
  {
    "id": "close",
    "chapter": "The result",
    "time": "2:45\u20133:00",
    "seconds": 15,
    "title": "An estimate you understand.\nA next step you can take.",
    "description": "A consumer app, a shared evidence desk, and tools an AI agent can use.",
    "takeaway": "Built for the Intact challenge \u00b7 Pixie prototype",
    "visual": "journey",
    "alt": "",
    "caption": "Quote \u00b7 Decide \u00b7 Protect \u00b7 Recover",
    "demo": "/intact",
    "demoLabel": "Explore the connected system",
    "narration": "Pixie makes insurance easier to explore and easier to understand. The phone helps the customer take the next step. The insurer gets the evidence. And the same controlled tools remain available through an agent.",
    "shots": [
      "Return to this slide. Leave it on screen for the closing sentence.",
      "Keep the prototype limitations visible for the final three seconds."
    ],
    "limit": "Tenant Home pricing only. Auto examples and credits are illustrative. No real policy binding or claim submission."
  }
];
