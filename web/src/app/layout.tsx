import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Condensed } from "next/font/google";
import { Chrome } from "@/components/desk/Chrome";
import "./globals.css";

// One superfamily, two widths. Mono carries every number and label; the condensed grotesk
// carries the few sentences a desk actually reads, at more words per line than a normal sans.
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", weight: ["400", "500", "600"] });
const cond = IBM_Plex_Sans_Condensed({ subsets: ["latin"], variable: "--font-plex-condensed", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Pixie underwriting desk",
  description: "Six agents investigate the facts that could change an underwriting decision.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mono.variable} ${cond.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-ochre focus:px-3 focus:py-1 focus:text-paper"
        >
          Skip to content
        </a>
        <Chrome />
        <div id="main" tabIndex={-1} className="contents">
          {children}
        </div>
      </body>
    </html>
  );
}
