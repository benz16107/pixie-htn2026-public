"use client";
import dynamic from "next/dynamic";

// MapLibre needs window, so it only renders on the client. The skeleton keeps the land colour.
export const LiveMap = dynamic(() => import("./BookMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-land motion-reduce:animate-none" />,
});

export const CaseMap = dynamic(() => import("./CaseMap"), {
  ssr: false,
  loading: () => null,
});
