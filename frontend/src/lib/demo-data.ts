const products = [
  { sku: "OTG-RAM-001", name: "Golden Kettle Mild Ramyeon Case", category: "Ready Meals", case_size: 12, shelf_life_days: 180 },
  { sku: "KIM-001", name: "Seorae Pear Kimchi Pouches", category: "Fermented", case_size: 8, shelf_life_days: 120 },
  { sku: "GOJ-001", name: "Namu Ginger Gochu Jars", category: "Sauce", case_size: 12, shelf_life_days: 365 },
  { sku: "RAM-001", name: "Dokkae Chili Ramyeon Bowls", category: "Noodles", case_size: 24, shelf_life_days: 240 },
  { sku: "SNK-001", name: "Mirim Plum Crisp Multipacks", category: "Snacks", case_size: 10, shelf_life_days: 365 }
];

const customers = [
  { customer_id: "CUST-001", name: "H Mart Foods 1", region: "West", channel: "Retail" },
  { customer_id: "CUST-002", name: "Pacific Market 2", region: "Northeast", channel: "Distributor" },
  { customer_id: "CUST-003", name: "Sunrise Kitchen 3", region: "South", channel: "Foodservice" },
  { customer_id: "CUST-004", name: "Freshway Grocers 4", region: "Midwest", channel: "Club" }
];

export const demoDashboard = {
  kpis: {
    total_inventory_value: 1286400,
    inventory_at_risk_value: 187250,
    projected_stockouts: 7,
    recommended_reorder_value: 241800,
    waste_reduction_opportunity: 65538
  },
  charts: {
    demand_trend_by_sku: [
      {
        sku: "OTG-RAM-001",
        points: [
          { label: "2025-07", value: 820 },
          { label: "2025-08", value: 880 },
          { label: "2025-09", value: 910 },
          { label: "2025-10", value: 940 },
          { label: "2025-11", value: 1040 },
          { label: "2025-12", value: 1180 },
          { label: "2026-01", value: 930 },
          { label: "2026-02", value: 970 },
          { label: "2026-03", value: 1100 },
          { label: "2026-04", value: 1160 },
          { label: "2026-05", value: 1230 },
          { label: "2026-06", value: 1260 }
        ]
      },
      {
        sku: "KIM-001",
        points: [
          { label: "2025-07", value: 520 },
          { label: "2025-08", value: 610 },
          { label: "2025-09", value: 650 },
          { label: "2025-10", value: 690 },
          { label: "2025-11", value: 760 },
          { label: "2025-12", value: 700 },
          { label: "2026-01", value: 680 },
          { label: "2026-02", value: 720 },
          { label: "2026-03", value: 790 },
          { label: "2026-04", value: 840 },
          { label: "2026-05", value: 860 },
          { label: "2026-06", value: 890 }
        ]
      }
    ],
    inventory_by_expiration_bucket: [
      { bucket: "expired", quantity: 120, value: 4860 },
      { bucket: "0-30 days", quantity: 2840, value: 84200 },
      { bucket: "31-60 days", quantity: 3920, value: 103050 },
      { bucket: "61-90 days", quantity: 5140, value: 132800 },
      { bucket: "90+ days", quantity: 42900, value: 961490 }
    ],
    reorder_urgency: [
      { status: "stockout risk", count: 7 },
      { status: "reorder now", count: 12 },
      { status: "wait", count: 44 },
      { status: "overstocked", count: 9 }
    ]
  },
  recommendations: [
    {
      sku: "OTG-RAM-001",
      warehouse: "LA DC",
      status: "stockout risk",
      recommended_order_qty: 1800,
      reorder_by_date: "2026-06-01",
      confidence: 0.88,
      reason: "Stockout risk due to 30-day ocean freight lead time: effective inventory is below lead-time demand after excluding units expiring before replenishment."
    },
    {
      sku: "RAM-001",
      warehouse: "NJ DC",
      status: "reorder now",
      recommended_order_qty: 960,
      reorder_by_date: "2026-06-03",
      confidence: 0.82,
      reason: "Reorder now because inventory position is at the reorder point based on average daily demand plus safety stock."
    },
    {
      sku: "KIM-001",
      warehouse: "Dallas DC",
      status: "overstocked",
      recommended_order_qty: 0,
      reorder_by_date: "2026-06-30",
      confidence: 0.74,
      reason: "Overstocked with more than 90 days of supply and near-expiring inventory; prioritize FEFO allocation and regional transfer."
    }
  ],
  fefo: [
    {
      sku: "OTG-RAM-001",
      warehouse: "LA DC",
      ship_first_lot: "LOT-00124",
      expiration_date: "2026-07-16",
      risk_bucket: "31-60 days",
      suggested_action: "Transfer to higher-demand warehouse or attach to near-term promotions.",
      reason: "Ship Lot LOT-00124 first because it expires 45 days before Lot LOT-00318."
    },
    {
      sku: "KIM-001",
      warehouse: "Dallas DC",
      ship_first_lot: "LOT-00047",
      expiration_date: "2026-06-24",
      risk_bucket: "0-30 days",
      suggested_action: "Priority allocate to fastest-turning customers or discount immediately.",
      reason: "Ship Lot LOT-00047 first because it expires 28 days before Lot LOT-00402."
    }
  ],
  waste_risk_alerts: [
    {
      sku: "KIM-001",
      lot_id: "LOT-00047",
      warehouse: "Dallas DC",
      quantity_at_risk: 640,
      expiration_date: "2026-06-24",
      risk_bucket: "0-30 days",
      suggested_action: "Priority allocate to fastest-turning customers or discount immediately."
    },
    {
      sku: "OTG-RAM-001",
      lot_id: "LOT-00124",
      warehouse: "LA DC",
      quantity_at_risk: 420,
      expiration_date: "2026-07-16",
      risk_bucket: "31-60 days",
      suggested_action: "Transfer to higher-demand warehouse or attach to near-term promotions."
    }
  ],
  roi_explanation:
    "Recoverable waste opportunity estimates margin that can be protected by moving at-risk lots through FEFO allocation, transfer, promotion, or discount action before they become distressed."
};

export function demoSkuDetail(sku: string) {
  const product = products.find((item) => item.sku === sku) || products[0];
  return {
    product,
    inventory_lots: [
      {
        lot_id: "LOT-00124",
        warehouse: "LA DC",
        quantity_on_hand: 420,
        received_date: "2026-01-17",
        expiration_date: "2026-07-16",
        unit_cost: 28.4
      },
      {
        lot_id: "LOT-00318",
        warehouse: "LA DC",
        quantity_on_hand: 880,
        received_date: "2026-03-04",
        expiration_date: "2026-08-30",
        unit_cost: 29.1
      }
    ],
    inbound_shipments: [
      { shipment_id: "INB-0007", quantity: 1800, eta_date: "2026-06-28", origin: "Busan", status: "in_transit" }
    ],
    forecast: {
      blended_daily_demand: 42.1,
      horizons: [
        { horizon_days: 30, forecast_quantity: 1263, daily_demand: 42.1 },
        { horizon_days: 60, forecast_quantity: 2526, daily_demand: 42.1 },
        { horizon_days: 90, forecast_quantity: 3789, daily_demand: 42.1 }
      ],
      models: { moving_average: 40.8, exponential_smoothing: 43.4 },
      trend: "upward placeholder: recent 30-day demand is above the prior 30 days",
      seasonality: "seasonality placeholder: compare against same-month demand once more annual cycles are available"
    },
    reorder_recommendations: demoDashboard.recommendations.filter((item) => item.sku === sku),
    fefo: demoDashboard.fefo.filter((item) => item.sku === sku),
    demand_trend: demoDashboard.charts.demand_trend_by_sku.filter((item) => item.sku === sku)
  };
}

export function demoCustomerDetail(customerId: string) {
  const customer = customers.find((item) => item.customer_id === customerId) || customers[0];
  return {
    customer,
    summary: {
      total_orders: 84,
      total_units: 21840,
      last_order_date: "2026-05-19"
    },
    top_skus: [
      { sku: "OTG-RAM-001", name: "Golden Kettle Mild Ramyeon Case", category: "Ready Meals", quantity: 6240 },
      { sku: "KIM-001", name: "Seorae Pear Kimchi Pouches", category: "Fermented", quantity: 4160 },
      { sku: "RAM-001", name: "Dokkae Chili Ramyeon Bowls", category: "Noodles", quantity: 3720 }
    ],
    monthly_trend: [
      { label: "2026-01", value: 1640 },
      { label: "2026-02", value: 1720 },
      { label: "2026-03", value: 1880 },
      { label: "2026-04", value: 1920 },
      { label: "2026-05", value: 2040 }
    ]
  };
}

function demoQuery(question: string) {
  const normalized = question.toLowerCase();
  if (normalized.includes("customer") && normalized.includes("otg-ram-001")) {
    return {
      question,
      template: "monthly_sku_buyers",
      explanation: "Customers shown here buy OTG-RAM-001 with recurring monthly behavior in the loaded order history.",
      columns: ["customer_id", "name", "region", "channel", "months_with_orders", "monthly_coverage", "avg_monthly_quantity"],
      rows: [
        { customer_id: "CUST-001", name: "H Mart Foods 1", region: "West", channel: "Retail", months_with_orders: 21, monthly_coverage: 0.88, avg_monthly_quantity: 260 },
        { customer_id: "CUST-002", name: "Pacific Market 2", region: "Northeast", channel: "Distributor", months_with_orders: 19, monthly_coverage: 0.79, avg_monthly_quantity: 210 }
      ],
      safe_query_mode: "demo_rule_based_templates_only"
    };
  }
  if (normalized.includes("expire")) {
    return {
      question,
      template: "expiring_inventory",
      explanation: "These lots expire within 90 days and should be prioritized before newer inventory.",
      columns: ["sku", "lot_id", "warehouse", "quantity_at_risk", "expiration_date", "risk_bucket", "suggested_action"],
      rows: demoDashboard.waste_risk_alerts,
      safe_query_mode: "demo_rule_based_templates_only"
    };
  }
  return {
    question,
    template: "reorder_this_week",
    explanation: "These replenishment actions are due within the next 7 days based on stock position and lead-time demand.",
    columns: ["sku", "warehouse", "status", "recommended_order_qty", "reorder_by_date", "reason", "confidence"],
    rows: demoDashboard.recommendations,
    safe_query_mode: "demo_rule_based_templates_only"
  };
}

export function getDemoGet(path: string) {
  if (path.startsWith("/api/dashboard")) return demoDashboard;
  if (path.startsWith("/api/products")) return { rows: products, count: products.length };
  if (path.startsWith("/api/customers?")) return { rows: customers, count: customers.length };
  if (path.startsWith("/api/sku/")) return demoSkuDetail(decodeURIComponent(path.split("/api/sku/")[1]));
  if (path.startsWith("/api/customers/")) return demoCustomerDetail(decodeURIComponent(path.split("/api/customers/")[1]));
  return undefined;
}

export function getDemoPost(path: string, body: unknown) {
  if (path === "/api/query") {
    const question = typeof body === "object" && body && "question" in body ? String(body.question) : "";
    return demoQuery(question);
  }
  return undefined;
}
