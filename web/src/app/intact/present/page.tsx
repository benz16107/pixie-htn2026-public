import type { Metadata } from 'next';
import { IntactPresentation } from './IntactPresentation';

export const metadata: Metadata = {
  title: 'Pixie · Intact video story',
  description: 'A three-minute product story for Home and Auto: estimates, choices, driving insights, witness evidence, and MCP tools.',
};

export default function IntactPresentationPage() {
  return <IntactPresentation />;
}
