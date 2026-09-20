import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pixie for Intact · Quote to recovery",
  description: "A connected tenant and Auto insurance journey through quote, decision, prevention, and recovery.",
};

export default function IntactLayout({ children }: LayoutProps<"/intact">) {
  return children;
}
