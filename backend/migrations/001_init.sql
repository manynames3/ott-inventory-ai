CREATE TABLE IF NOT EXISTS products (
    sku VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(120) NOT NULL,
    case_size INTEGER NOT NULL,
    shelf_life_days INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_lots (
    lot_id VARCHAR(96) PRIMARY KEY,
    sku VARCHAR(64) NOT NULL REFERENCES products(sku),
    warehouse VARCHAR(120) NOT NULL,
    quantity_on_hand INTEGER NOT NULL CHECK (quantity_on_hand >= 0),
    received_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    unit_cost DOUBLE PRECISION NOT NULL CHECK (unit_cost >= 0)
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(96) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(120) NOT NULL,
    channel VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(96) PRIMARY KEY,
    customer_id VARCHAR(96) NOT NULL REFERENCES customers(customer_id),
    order_date DATE NOT NULL,
    sku VARCHAR(64) NOT NULL REFERENCES products(sku),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS inbound_shipments (
    shipment_id VARCHAR(96) PRIMARY KEY,
    sku VARCHAR(64) NOT NULL REFERENCES products(sku),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    eta_date DATE NOT NULL,
    origin VARCHAR(160) NOT NULL,
    status VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS reorder_recommendations (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(64) NOT NULL REFERENCES products(sku),
    warehouse VARCHAR(120) NOT NULL,
    recommended_order_qty INTEGER NOT NULL CHECK (recommended_order_qty >= 0),
    reorder_by_date DATE NOT NULL,
    reason TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    status VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waste_risk_alerts (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(64) NOT NULL REFERENCES products(sku),
    lot_id VARCHAR(96) NOT NULL REFERENCES inventory_lots(lot_id),
    warehouse VARCHAR(120) NOT NULL,
    quantity_at_risk INTEGER NOT NULL CHECK (quantity_at_risk >= 0),
    expiration_date DATE NOT NULL,
    suggested_action TEXT NOT NULL,
    risk_bucket VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_sku_warehouse_expiration
    ON inventory_lots(sku, warehouse, expiration_date);

CREATE INDEX IF NOT EXISTS idx_orders_sku_date
    ON orders(sku, order_date);

CREATE INDEX IF NOT EXISTS idx_orders_customer_date
    ON orders(customer_id, order_date);

CREATE INDEX IF NOT EXISTS idx_inbound_sku_eta
    ON inbound_shipments(sku, eta_date);

CREATE INDEX IF NOT EXISTS idx_reorder_status_date
    ON reorder_recommendations(status, reorder_by_date);

CREATE INDEX IF NOT EXISTS idx_waste_expiration
    ON waste_risk_alerts(expiration_date, risk_bucket);

CREATE TABLE IF NOT EXISTS action_reviews (
    action_key VARCHAR(512) PRIMARY KEY,
    status VARCHAR(32) NOT NULL CHECK (status IN ('open', 'accepted', 'dismissed')),
    note TEXT NOT NULL DEFAULT '',
    action_snapshot TEXT NOT NULL DEFAULT '{}',
    updated_by VARCHAR(255) NOT NULL,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE action_reviews
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);

ALTER TABLE action_reviews
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_action_reviews_status_updated
    ON action_reviews(status, updated_at DESC);
