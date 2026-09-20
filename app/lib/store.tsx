import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Answers, Place } from './api';
import { AUTO_LISTINGS, DEFAULT_AUTO_PROFILE, type AutoListing, type AutoProfile, type ConsumerProduct } from './consumer';
import type { DriveSessionSummary } from './driving';

const DEFAULT: Answers = { contentsValue: 30000, unitLevel: 'upper', claims3yr: 0, deductible: 1000, liability: 1_000_000 };

type Store = {
  product: ConsumerProduct;
  setProduct: (product: ConsumerProduct) => void;
  place: Place | null;
  setPlace: (p: Place | null) => void;
  answers: Answers;
  setAnswers: (a: Partial<Answers>) => void;
  autoListing: AutoListing;
  setAutoListing: (listing: AutoListing) => void;
  autoProfile: AutoProfile;
  setAutoProfile: (profile: Partial<AutoProfile>) => void;
  driveSummary: DriveSessionSummary | null;
  setDriveSummary: (summary: DriveSessionSummary | null) => void;
};

const Ctx = createContext<Store | null>(null);

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<ConsumerProduct>('home');
  const [place, setPlace] = useState<Place | null>(null);
  const [answers, set] = useState<Answers>(DEFAULT);
  const [autoListing, setAutoListing] = useState(AUTO_LISTINGS[0]);
  const [autoProfile, setAuto] = useState<AutoProfile>(DEFAULT_AUTO_PROFILE);
  const [driveSummary, setDriveSummary] = useState<DriveSessionSummary | null>(null);
  return (
    <Ctx.Provider
      value={{
        product,
        setProduct,
        place,
        setPlace,
        answers,
        setAnswers: (a) => set((s) => ({ ...s, ...a })),
        autoListing,
        setAutoListing,
        autoProfile,
        setAutoProfile: (profile) => setAuto((current) => ({ ...current, ...profile })),
        driveSummary,
        setDriveSummary,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useQuote = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useQuote outside QuoteProvider');
  return s;
};
