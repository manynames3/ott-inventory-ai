import { Suspense } from "react";

import { CustomerDetailClient } from "./customer-detail-client";

export default function CustomerPage() {
  return (
    <Suspense fallback={<div className="empty-state">Loading customer detail</div>}>
      <CustomerDetailClient />
    </Suspense>
  );
}

