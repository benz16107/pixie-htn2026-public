export type ConsumerProduct = 'home' | 'auto';

export type AutoDeductible = 500 | 1000 | 2000;
export type AnnualKmBand = 'under_10000' | '10000_20000' | 'over_20000';
export type Parking = 'garage' | 'driveway' | 'street';

export interface AutoProfile {
  annualKmBand: AnnualKmBand;
  parking: Parking;
  deductible: AutoDeductible;
  claims5yr: number;
}

export interface AutoListing {
  id: 'corolla-le-2023' | 'cx5-gs-2022' | 'ioniq5-preferred-2024';
  year: number;
  make: string;
  model: string;
  listingPrice: number;
  paymentMonthly: number;
  vehicleFactor: number;
  provenance: string;
}

export interface AutoEstimateFactor {
  label: string;
  multiplier: number;
  dollars: number;
  source: string;
}

export interface AutoEstimateView {
  quoteId: string;
  vehicleId: AutoListing['id'];
  annual: number;
  monthly: number;
  ownershipMonthly: number;
  factors: AutoEstimateFactor[];
  decision: { kind: 'estimate_ready' | 'advisor_review'; reasons: string[]; nextStep: string };
  label: string;
}

export type AutoEstimateResult =
  | { estimate: AutoEstimateView; source: 'shared-api' | 'bundled-demo' }
  | { error: string };

export const DEFAULT_AUTO_PROFILE: AutoProfile = {
  annualKmBand: '10000_20000',
  parking: 'driveway',
  deductible: 1000,
  claims5yr: 0,
};

// Mirrors api/fixtures/consumer_demo.json so the offline and API paths tell one story.
export const AUTO_LISTINGS: AutoListing[] = [
  {
    id: 'corolla-le-2023', year: 2023, make: 'Toyota', model: 'Corolla LE', listingPrice: 25900,
    paymentMonthly: 432, vehicleFactor: 0.92,
    provenance: 'Bundled synthetic listing; compact vehicle class from the illustrative demo table',
  },
  {
    id: 'cx5-gs-2022', year: 2022, make: 'Mazda', model: 'CX-5 GS', listingPrice: 30900,
    paymentMonthly: 515, vehicleFactor: 1.04,
    provenance: 'Bundled synthetic listing; compact SUV class from the illustrative demo table',
  },
  {
    id: 'ioniq5-preferred-2024', year: 2024, make: 'Hyundai', model: 'IONIQ 5 Preferred', listingPrice: 48999,
    paymentMonthly: 817, vehicleFactor: 1.12,
    provenance: 'Bundled synthetic listing; EV repair-cost class from the illustrative demo table',
  },
];

export const autoName = (vehicle: AutoListing) => `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

const BAND_MULTIPLIER: Record<AnnualKmBand, number> = { under_10000: 0.92, '10000_20000': 1, over_20000: 1.12 };
const PARKING_MULTIPLIER: Record<Parking, number> = { garage: 0.94, driveway: 1, street: 1.08 };
const DEDUCTIBLE_MULTIPLIER: Record<AutoDeductible, number> = { 500: 1.08, 1000: 1, 2000: 0.91 };

export function bundledAutoEstimate(vehicle: AutoListing, profile: AutoProfile): AutoEstimateView {
  const claimMultiplier = profile.claims5yr === 0 ? 1 : profile.claims5yr === 1 ? 1.22 : 1.45;
  const factors = [
    { label: 'Vehicle class', multiplier: vehicle.vehicleFactor, source: vehicle.provenance },
    { label: 'Annual distance', multiplier: BAND_MULTIPLIER[profile.annualKmBand], source: 'Bundled illustrative distance table' },
    { label: 'Overnight parking', multiplier: PARKING_MULTIPLIER[profile.parking], source: 'Bundled illustrative parking table' },
    { label: 'Deductible', multiplier: DEDUCTIBLE_MULTIPLIER[profile.deductible], source: 'Bundled illustrative deductible table' },
    { label: 'Claims in five years', multiplier: claimMultiplier, source: 'Bundled illustrative claims table' },
  ].map((factor) => ({ ...factor, dollars: Math.round(1180 * (factor.multiplier - 1)) }));
  const annual = Math.round(1180 * factors.reduce((total, factor) => total * factor.multiplier, 1));
  const monthly = Math.round(annual / 12);
  const review = profile.claims5yr >= 2;
  return {
    quoteId: `AQ-DEMO-${vehicle.id.toUpperCase()}`,
    vehicleId: vehicle.id,
    annual,
    monthly,
    ownershipMonthly: vehicle.paymentMonthly + monthly,
    factors,
    decision: {
      kind: review ? 'advisor_review' : 'estimate_ready',
      reasons: review ? ['Two or more claims need an advisor review.'] : ['All bundled demo inputs were priced.'],
      nextStep: review ? 'Review these details with an advisor.' : 'Choose this vehicle or test another scenario.',
    },
    label: 'Illustrative Pixie estimate from bundled synthetic inputs. Not an insurer quote or offer.',
  };
}

const API = process.env.EXPO_PUBLIC_API_URL;

type ApiAutoQuote = {
  quoteId: string;
  annual: number;
  monthly: number;
  label: string;
  decision: AutoEstimateView['decision'];
  receipt?: { lines?: Array<{ label: string; multiplier: number; dollars: number; source: string }> };
};

function isApiQuote(value: unknown): value is ApiAutoQuote {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ApiAutoQuote>;
  return typeof candidate.quoteId === 'string' && typeof candidate.annual === 'number' && typeof candidate.monthly === 'number';
}

export async function quoteAuto(vehicle: AutoListing, profile: AutoProfile): Promise<AutoEstimateResult> {
  if (API) {
    try {
      const response = await fetch(`${API}/quote/auto`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vehicleId: vehicle.id, ...profile }),
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) {
        const payload: unknown = await response.json();
        if (isApiQuote(payload)) {
          return {
            source: 'shared-api',
            estimate: {
              quoteId: payload.quoteId,
              vehicleId: vehicle.id,
              annual: payload.annual,
              monthly: payload.monthly,
              ownershipMonthly: vehicle.paymentMonthly + payload.monthly,
              factors: (payload.receipt?.lines ?? []).map((line) => ({ ...line })),
              decision: payload.decision,
              label: payload.label,
            },
          };
        }
      }
    } catch {}
  }
  return { estimate: bundledAutoEstimate(vehicle, profile), source: 'bundled-demo' };
}

export const HOME_PROTECT_ACTIONS = [
  { id: 'inventory', title: 'Create a room inventory', detail: 'Keep photos and values ready before a loss.' },
  { id: 'water', title: 'Add a leak sensor', detail: 'Place one near a washer, sink, or water heater.' },
  { id: 'alarms', title: 'Test smoke and CO alarms', detail: 'Record the test date with the policy.' },
] as const;

export const AUTO_PROTECT_ACTIONS = [
  { id: 'tracker', title: 'Record a theft tracker', detail: 'Save the device and installation date.' },
  { id: 'tires', title: 'Log winter tires', detail: 'Keep the seasonal installation receipt.' },
  { id: 'baseline', title: 'Photograph the VIN and mileage', detail: 'Create a clean pre-loss reference.' },
] as const;
