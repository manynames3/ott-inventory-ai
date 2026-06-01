import type { Metadata } from "next";

import { SalesLandingPage } from "@/components/sales-landing-page";

export const metadata: Metadata = {
  title: "Inventory AI for OTOKI Operations",
  description: "Expiration-aware inventory intelligence for OTOKI-style food and CPG operations."
};

export default function LandingPage() {
  return <SalesLandingPage />;
}
