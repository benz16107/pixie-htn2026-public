import type { Metadata } from "next";
import { Presentation } from "./Presentation";

export const metadata: Metadata = { title: "Pixie · Federato presentation" };

export default function PresentPage() {
  return <Presentation />;
}
