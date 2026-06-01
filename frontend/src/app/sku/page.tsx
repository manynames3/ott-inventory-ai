import { Suspense } from "react";

import { SkuDetailClient } from "./sku-detail-client";

export default function SkuPage() {
  return (
    <Suspense fallback={<div className="empty-state">Loading SKU detail</div>}>
      <SkuDetailClient />
    </Suspense>
  );
}

