import type { Metadata } from "next";

import { SalesLandingPage } from "@/components/sales-landing-page";

export const metadata: Metadata = {
  title: "오뚜기 운영을 위한 Inventory AI",
  description: "오뚜기형 식품 운영을 위한 유통기한·결품 리스크 재고 인텔리전스."
};

export default function SalesPage() {
  return <SalesLandingPage />;
}
