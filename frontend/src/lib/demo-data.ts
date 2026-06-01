const products = [
  { sku: "OTG-RAM-001", name: "Ottogi Jin Ramen Spicy Multi-Pack", category: "Noodles", case_size: 20, shelf_life_days: 270 },
  { sku: "OTG-RAM-002", name: "Ottogi Jin Ramen Mild Multi-Pack", category: "Noodles", case_size: 20, shelf_life_days: 270 },
  { sku: "OTG-RAM-003", name: "Ottogi Jin Ramen Veggie Multi-Pack", category: "Noodles", case_size: 20, shelf_life_days: 270 },
  { sku: "OTG-RAM-004", name: "Ottogi Sesame Ramen with Egg Block", category: "Noodles", case_size: 20, shelf_life_days: 270 },
  { sku: "OTG-RAM-005", name: "Ottogi Cheese Ramen Multi-Pack", category: "Noodles", case_size: 20, shelf_life_days: 270 },
  { sku: "OTG-RAM-006", name: "Ottogi Yeul Ramen Hot Pepper", category: "Noodles", case_size: 20, shelf_life_days: 270 },
  { sku: "OTG-RAM-007", name: "Ottogi Snack Ramen Multi-Pack", category: "Noodles", case_size: 20, shelf_life_days: 270 },
  { sku: "OTG-RAM-008", name: "Ottogi Ramen Sari Plain Noodle", category: "Noodles", case_size: 40, shelf_life_days: 270 },
  { sku: "OTG-RAM-009", name: "Ottogi Jin Jjambbong Spicy Seafood", category: "Noodles", case_size: 16, shelf_life_days: 270 },
  { sku: "OTG-RAM-010", name: "Ottogi Jin Jjajang Black Bean Noodle", category: "Noodles", case_size: 16, shelf_life_days: 270 },
  { sku: "OTG-RAM-011", name: "Ottogi Spaghetti Ramen", category: "Noodles", case_size: 16, shelf_life_days: 270 },
  { sku: "OTG-RAM-012", name: "Ottogi Curry Ramen", category: "Noodles", case_size: 16, shelf_life_days: 270 },
  { sku: "OTG-RAM-013", name: "Ottogi Odongtong Myon Seafood Noodle", category: "Noodles", case_size: 16, shelf_life_days: 270 },
  { sku: "OTG-RAM-014", name: "Ottogi Buckwheat Bibim Noodle", category: "Noodles", case_size: 16, shelf_life_days: 240 },
  { sku: "OTG-RAM-015", name: "Ottogi Cup Noodle Spicy", category: "Noodles", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-RAM-016", name: "Ottogi Cup Noodle Udon", category: "Noodles", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-CUR-001", name: "Ottogi 3 Minute Curry Mild Pouch", category: "Curry", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-CUR-002", name: "Ottogi 3 Minute Curry Medium Pouch", category: "Curry", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-CUR-003", name: "Ottogi 3 Minute Curry Hot Pouch", category: "Curry", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-CUR-004", name: "Ottogi 3 Minute Jjajang Sauce Pouch", category: "Curry", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-CUR-005", name: "Ottogi Vermont Curry Mild Powder", category: "Curry", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-CUR-006", name: "Ottogi Vermont Curry Hot Powder", category: "Curry", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-CUR-007", name: "Ottogi Baekse Curry Powder", category: "Curry", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-CUR-008", name: "Ottogi 3-Day Aged Curry Powder", category: "Curry", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-CUR-009", name: "Ottogi Butter Chicken Curry Pouch", category: "Curry", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-CUR-010", name: "Ottogi Honey Mango Curry Pouch", category: "Curry", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-CUR-011", name: "Ottogi Hash Rice Sauce Pouch", category: "Curry", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-CUR-012", name: "Ottogi Curry Powder Mild", category: "Curry", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-RIC-001", name: "Ottogi Cooked Rice White Bowl", category: "Ready Rice", case_size: 18, shelf_life_days: 240 },
  { sku: "OTG-RIC-002", name: "Ottogi Cooked Rice Brown Bowl", category: "Ready Rice", case_size: 18, shelf_life_days: 240 },
  { sku: "OTG-RIC-003", name: "Ottogi Cooked Rice Kimchi Tuna Sauce", category: "Ready Rice", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-RIC-004", name: "Ottogi Cooked Rice Jeonju Bibimbap", category: "Ready Rice", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-RIC-005", name: "Ottogi Cooked Rice Teriyaki Tuna Mayo", category: "Ready Rice", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-RIC-006", name: "Ottogi Cooked Rice Spicy Octopus Sauce", category: "Ready Rice", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-RIC-007", name: "Ottogi Cooked Rice Bean Sprout Pollock", category: "Ready Rice", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-RIC-008", name: "Ottogi Cooked Rice Hamburg Steak", category: "Ready Rice", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-RIC-009", name: "Ottogi Cooked Rice Soybean Paste Beef", category: "Ready Rice", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-RIC-010", name: "Ottogi 3 Minute Hamburg Steak", category: "Ready Meals", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-RIC-011", name: "Ottogi 3 Minute Meatball Sweet Sour", category: "Ready Meals", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-RIC-012", name: "Ottogi 3 Minute Barbecue Chicken", category: "Ready Meals", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-SAU-001", name: "Ottogi Tomato Ketchup", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SAU-002", name: "Ottogi Mayonnaise", category: "Sauce", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SAU-003", name: "Ottogi Gold Mayonnaise", category: "Sauce", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SAU-004", name: "Ottogi Tonkatsu Sauce", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SAU-005", name: "Ottogi Worcestershire Sauce", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SAU-006", name: "Ottogi Tartar Sauce", category: "Sauce", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SAU-007", name: "Ottogi Honey Mustard", category: "Sauce", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SAU-008", name: "Ottogi Sesame Dressing", category: "Sauce", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SAU-009", name: "Ottogi Korean BBQ Bulgogi Sauce", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SAU-010", name: "Ottogi Gochujang Sauce", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SAU-011", name: "Ottogi Jjajang Sauce", category: "Sauce", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-SAU-012", name: "Ottogi Spaghetti Tomato Sauce", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SAU-013", name: "Ottogi Pizza Sauce", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SAU-014", name: "Ottogi Sweet Chili Sauce", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SAU-015", name: "Ottogi Black Pepper Steak Sauce", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SAU-016", name: "Ottogi Pickling Sauce Base", category: "Sauce", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-OIL-001", name: "Ottogi Sesame Oil", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-OIL-002", name: "Ottogi Perilla Oil", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-OIL-003", name: "Ottogi Roasted Sesame Oil", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-OIL-004", name: "Ottogi Canola Oil", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-OIL-005", name: "Ottogi Corn Oil", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-OIL-006", name: "Ottogi Cooking Oil", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-VNG-001", name: "Ottogi Apple Vinegar", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-VNG-002", name: "Ottogi Brown Rice Vinegar", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-VNG-003", name: "Ottogi Brewed Vinegar", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-VNG-004", name: "Ottogi White Vinegar", category: "Oil & Vinegar", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SSN-001", name: "Ottogi Roasted Sesame Seeds", category: "Seasoning", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-SSN-002", name: "Ottogi Black Sesame Seeds", category: "Seasoning", case_size: 24, shelf_life_days: 365 },
  { sku: "OTG-MIX-001", name: "Ottogi Frying Mix", category: "Mix & Powder", case_size: 10, shelf_life_days: 365 },
  { sku: "OTG-MIX-002", name: "Ottogi Pancake Mix", category: "Mix & Powder", case_size: 10, shelf_life_days: 365 },
  { sku: "OTG-MIX-003", name: "Ottogi Tempura Mix", category: "Mix & Powder", case_size: 10, shelf_life_days: 365 },
  { sku: "OTG-MIX-004", name: "Ottogi Hotcake Mix", category: "Mix & Powder", case_size: 10, shelf_life_days: 365 },
  { sku: "OTG-MIX-005", name: "Ottogi Bread Crumbs", category: "Mix & Powder", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-MIX-006", name: "Ottogi Corn Soup Powder", category: "Mix & Powder", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-MIX-007", name: "Ottogi Cream Soup Powder", category: "Mix & Powder", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-MIX-008", name: "Ottogi Onion Soup Powder", category: "Mix & Powder", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-MIX-009", name: "Ottogi Beef Stock Powder", category: "Mix & Powder", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-MIX-010", name: "Ottogi Anchovy Stock Powder", category: "Mix & Powder", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-MIX-011", name: "Ottogi Kimchi Seasoning Powder", category: "Mix & Powder", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-MIX-012", name: "Ottogi Curry Flake", category: "Mix & Powder", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SOU-001", name: "Ottogi Seaweed Soup", category: "Soup & HMR", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SOU-002", name: "Ottogi Beef Bone Soup", category: "Soup & HMR", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SOU-003", name: "Ottogi Dried Pollack Soup", category: "Soup & HMR", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SOU-004", name: "Ottogi Soybean Paste Stew", category: "Soup & HMR", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SOU-005", name: "Ottogi Kimchi Stew", category: "Soup & HMR", case_size: 12, shelf_life_days: 365 },
  { sku: "OTG-SOU-006", name: "Ottogi Rice Cake Soup Bowl", category: "Soup & HMR", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-SOU-007", name: "Ottogi Beef Bulgogi Bowl", category: "Soup & HMR", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-SOU-008", name: "Ottogi Pork Kimchi Bowl", category: "Soup & HMR", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-SOU-009", name: "Ottogi Spicy Chicken Bowl", category: "Soup & HMR", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-SOU-010", name: "Ottogi Japchae Bowl", category: "Soup & HMR", case_size: 12, shelf_life_days: 240 },
  { sku: "OTG-FRZ-001", name: "Ottogi Mandu Tray Original", category: "Frozen", case_size: 8, shelf_life_days: 540 },
  { sku: "OTG-FRZ-002", name: "Ottogi Kimchi Mandu Tray", category: "Frozen", case_size: 8, shelf_life_days: 540 },
  { sku: "OTG-FRZ-003", name: "Ottogi Vegetable Mandu Tray", category: "Frozen", case_size: 8, shelf_life_days: 540 },
  { sku: "OTG-FRZ-004", name: "Ottogi Frozen Cheese Pizza", category: "Frozen", case_size: 8, shelf_life_days: 540 },
  { sku: "OTG-FRZ-005", name: "Ottogi Frozen Bulgogi Pizza", category: "Frozen", case_size: 8, shelf_life_days: 540 },
  { sku: "OTG-FRZ-006", name: "Ottogi Shrimp Fried Rice", category: "Frozen", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-FRZ-007", name: "Ottogi Kimchi Fried Rice", category: "Frozen", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-FRZ-008", name: "Ottogi Curry Fried Rice", category: "Frozen", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-SNK-001", name: "Ottogi Ppushu Ppushu Bulgogi Snack Noodle", category: "Snacks", case_size: 12, shelf_life_days: 300 },
  { sku: "OTG-SNK-002", name: "Ottogi Ppushu Ppushu Tteokbokki Snack Noodle", category: "Snacks", case_size: 12, shelf_life_days: 300 },
  { sku: "OTG-TEA-001", name: "Ottogi Barley Tea", category: "Beverage", case_size: 20, shelf_life_days: 540 },
  { sku: "OTG-TEA-002", name: "Ottogi Corn Tea", category: "Beverage", case_size: 20, shelf_life_days: 540 },
  { sku: "OTG-TEA-003", name: "Ottogi Honey Citron Tea", category: "Beverage", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-TEA-004", name: "Ottogi Jujube Tea", category: "Beverage", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-TEA-005", name: "Ottogi Ginger Tea", category: "Beverage", case_size: 12, shelf_life_days: 540 },
  { sku: "OTG-CAN-001", name: "Ottogi Hot Pepper Tuna", category: "Canned", case_size: 24, shelf_life_days: 540 },
  { sku: "OTG-CAN-002", name: "Ottogi Vegetable Tuna", category: "Canned", case_size: 24, shelf_life_days: 540 },
  { sku: "OTG-CAN-003", name: "Ottogi Light Tuna", category: "Canned", case_size: 24, shelf_life_days: 540 },
  { sku: "OTG-SEA-001", name: "Ottogi Roasted Seaweed Snack", category: "Seaweed", case_size: 24, shelf_life_days: 300 },
  { sku: "OTG-SEA-002", name: "Ottogi Seaweed Crisps", category: "Seaweed", case_size: 24, shelf_life_days: 300 }
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
        sku: "OTG-SOU-005",
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
      sku: "OTG-RAM-002",
      warehouse: "NJ DC",
      status: "reorder now",
      recommended_order_qty: 960,
      reorder_by_date: "2026-06-03",
      confidence: 0.82,
      reason: "Reorder now because inventory position is at the reorder point based on average daily demand plus safety stock."
    },
    {
      sku: "OTG-SOU-005",
      warehouse: "Dallas DC",
      status: "overstocked",
      recommended_order_qty: 0,
      reorder_by_date: "2026-06-30",
      confidence: 0.74,
      reason: "Overstocked with more than 90 days of supply and near-expiring soup inventory; prioritize FEFO allocation and regional transfer."
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
      sku: "OTG-SOU-005",
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
      sku: "OTG-SOU-005",
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

const demoImportHistory = {
  rows: [
    {
      entity: "orders",
      status: "imported",
      message: "Imported 5,434 order rows and refreshed materialized insights.",
      rows_seen: 5434,
      rows_imported: 5434,
      errors: [],
      filename: "orders_ottogi_demo.csv",
      updated_at_epoch: 1780344000
    },
    {
      entity: "inventory_lots",
      status: "imported",
      message: "Imported 555 lot rows and refreshed FEFO/waste risk views.",
      rows_seen: 555,
      rows_imported: 555,
      errors: [],
      filename: "inventory_lots_ottogi_demo.csv",
      updated_at_epoch: 1780343880
    },
    {
      entity: "products",
      status: "imported",
      message: "Imported 110 products.",
      rows_seen: 110,
      rows_imported: 110,
      errors: [],
      filename: "products_ottogi_demo.csv",
      updated_at_epoch: 1780343760
    },
    {
      entity: "customers",
      status: "imported",
      message: "Imported 50 customers.",
      rows_seen: 50,
      rows_imported: 50,
      errors: [],
      filename: "customers_ottogi_demo.csv",
      updated_at_epoch: 1780343640
    },
    {
      entity: "inbound_shipments",
      status: "imported",
      message: "Imported 25 inbound shipments.",
      rows_seen: 25,
      rows_imported: 25,
      errors: [],
      filename: "inbound_shipments_ottogi_demo.csv",
      updated_at_epoch: 1780343520
    }
  ],
  count: 5,
  checklist: [
    {
      entity: "products",
      label: "Products",
      status: "complete",
      required_columns: ["sku", "name", "category", "case_size", "shelf_life_days"],
      message: "110 rows imported. Insights include this dataset.",
      rows_imported: 110,
      error_count: 0,
      updated_at_epoch: 1780343760
    },
    {
      entity: "inventory_lots",
      label: "Inventory lots",
      status: "complete",
      required_columns: [
        "lot_id",
        "sku",
        "warehouse",
        "quantity_on_hand",
        "received_date",
        "expiration_date",
        "unit_cost"
      ],
      message: "555 rows imported. Insights include this dataset.",
      rows_imported: 555,
      error_count: 0,
      updated_at_epoch: 1780343880
    },
    {
      entity: "customers",
      label: "Customers",
      status: "complete",
      required_columns: ["customer_id", "name", "region", "channel"],
      message: "50 rows imported. Insights include this dataset.",
      rows_imported: 50,
      error_count: 0,
      updated_at_epoch: 1780343640
    },
    {
      entity: "orders",
      label: "Orders",
      status: "complete",
      required_columns: ["order_id", "customer_id", "order_date", "sku", "quantity"],
      message: "5,434 rows imported. Insights include this dataset.",
      rows_imported: 5434,
      error_count: 0,
      updated_at_epoch: 1780344000
    },
    {
      entity: "inbound_shipments",
      label: "Inbound shipments",
      status: "complete",
      required_columns: ["shipment_id", "sku", "quantity", "eta_date", "origin", "status"],
      message: "25 rows imported. Insights include this dataset.",
      rows_imported: 25,
      error_count: 0,
      updated_at_epoch: 1780343520
    }
  ]
};

const demoAuditEvents = {
  rows: [
    {
      action: "login_success",
      resource: "auth",
      user: "pilot@inventory-ai.local",
      origin: "https://ott-inventory-ai.pages.dev",
      details: {},
      created_at_epoch: 1780344300
    },
    {
      action: "import_previewed",
      resource: "orders",
      user: "pilot@inventory-ai.local",
      origin: "https://ott-inventory-ai.pages.dev",
      details: { filename: "orders_ottogi_demo.csv", rows_seen: 5434, missing_mappings: [] },
      created_at_epoch: 1780344000
    },
    {
      action: "import_committed",
      resource: "orders",
      user: "pilot@inventory-ai.local",
      origin: "https://ott-inventory-ai.pages.dev",
      details: { rows_seen: 5434, mapped_columns: 5 },
      created_at_epoch: 1780343940
    },
    {
      action: "query_answered",
      resource: "stockout_risk",
      user: "pilot@inventory-ai.local",
      origin: "https://ott-inventory-ai.pages.dev",
      details: { question_preview: "Which SKUs will stock out in the next 30 days?", row_count: 7 },
      created_at_epoch: 1780343880
    }
  ],
  count: 4
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
      { sku: "OTG-RAM-001", name: "Ottogi Jin Ramen Spicy Multi-Pack", category: "Noodles", quantity: 6240 },
      { sku: "OTG-CUR-001", name: "Ottogi 3 Minute Curry Mild Pouch", category: "Curry", quantity: 4160 },
      { sku: "OTG-RAM-002", name: "Ottogi Jin Ramen Mild Multi-Pack", category: "Noodles", quantity: 3720 }
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
  if (path.startsWith("/api/import-history")) return demoImportHistory;
  if (path.startsWith("/api/audit-events")) return demoAuditEvents;
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
