from __future__ import annotations

import random
from datetime import date, timedelta

from app.config import get_settings
from app.database import SessionLocal
from app.models import (
    Customer,
    CustomerOrder,
    InboundShipment,
    InventoryLot,
    Product,
    ReorderRecommendation,
    WasteRiskAlert,
)
from app.services.jobs import refresh_recommendation_tables


random.seed(87)

WAREHOUSES = ["LA DC", "NJ DC", "Dallas DC", "Seattle DC"]
ORIGINS = ["Busan", "Incheon", "Pyeongtaek", "Los Angeles Co-Pack"]

PRODUCT_LINES = [
    ("OTG-RAM", "Noodles", "Ramyeon", 270, 24),
    ("OTG-CUR", "Curry", "Curry Pouch", 365, 12),
    ("OTG-SAU", "Sauce", "Gochu Sauce", 540, 12),
    ("OTG-OIL", "Oil", "Sesame Oil", 540, 12),
    ("OTG-RIC", "Ready Rice", "Rice Bowl", 240, 18),
    ("OTG-SOU", "Soup", "Seaweed Soup", 365, 12),
    ("OTG-MIX", "Pantry", "Pancake Mix", 365, 10),
    ("OTG-SNK", "Snacks", "Seaweed Crisp", 300, 16),
    ("OTG-TEA", "Beverage", "Barley Tea", 540, 20),
    ("OTG-FRZ", "Frozen", "Mandu Tray", 540, 8),
]

BRANDS = ["Golden Kettle", "Han Table", "Seoul Pantry", "Busan House", "Soban Select"]
FLAVORS = ["Mild", "Spicy", "Sesame", "Garlic", "Yuzu", "Roasted", "Seaweed", "Ginger", "Kimchi", "Black Bean"]

BASE_CUSTOMERS = [
    ("CUST-HMART-WEST", "H Mart West", "West", "Retail"),
    ("CUST-HMART-EAST", "H Mart East", "Northeast", "Retail"),
    ("CUST-COSTCO-WEST", "Costco West Grocery", "West", "Club"),
    ("CUST-AMZ-GROCERY", "Amazon Grocery Marketplace", "National", "E-commerce"),
    ("CUST-PACIFIC-DIST", "Pacific Korean Foods", "West", "Distributor"),
    ("CUST-NJ-KFOOD", "New Jersey K-Food Distributors", "Northeast", "Distributor"),
    ("CUST-DALLAS-MART", "Dallas Asian Market Group", "South", "Retail"),
    ("CUST-SEATTLE-GROC", "Seattle Fresh Grocers", "West", "Retail"),
    ("CUST-RESTAURANT-1", "Korean Kitchen Supply", "National", "Foodservice"),
    ("CUST-CLUB-MIDWEST", "Midwest Club Grocery", "Midwest", "Club"),
    ("CUST-SOCAL-MART", "SoCal Neighborhood Market", "West", "Retail"),
    ("CUST-CANADA-DIST", "Canada Korean Food Importers", "Canada", "Distributor"),
]

GENERATED_CUSTOMERS = [
    (
        f"CUST-PILOT-{index:03d}",
        f"{region} {banner} {channel} {index}",
        region,
        channel,
    )
    for index, (region, channel, banner) in enumerate(
        [
            (
                ["West", "Northeast", "South", "Midwest", "National", "Canada"][i % 6],
                ["Retail", "Club", "Distributor", "Foodservice", "E-commerce"][i % 5],
                ["K-Food Market", "Asian Grocery", "Pantry Supply", "Fresh Trading", "Meal Kit"][i % 5],
            )
            for i in range(38)
        ],
        start=13,
    )
]

CUSTOMERS = BASE_CUSTOMERS + GENERATED_CUSTOMERS


def build_products() -> list[Product]:
    products = []
    for index in range(100):
        prefix, category, base_name, shelf_life, case_size = PRODUCT_LINES[index % len(PRODUCT_LINES)]
        number = index // len(PRODUCT_LINES) + 1
        products.append(
            Product(
                sku=f"{prefix}-{number:03d}",
                name=(
                    f"{BRANDS[index % len(BRANDS)]} {FLAVORS[index % len(FLAVORS)]} "
                    f"{base_name} {case_size}ct"
                ),
                category=category,
                case_size=case_size,
                shelf_life_days=shelf_life,
            )
        )
    return products


def build_customers() -> list[Customer]:
    return [
        Customer(customer_id=customer_id, name=name, region=region, channel=channel)
        for customer_id, name, region, channel in CUSTOMERS
    ]


def build_orders(products: list[Product], customers: list[Customer]) -> list[CustomerOrder]:
    today = date.today()
    high_velocity = ["OTG-RAM-001", "OTG-RAM-002", "OTG-CUR-001", "OTG-RIC-001", "OTG-OIL-001"]
    all_skus = [product.sku for product in products]
    orders: list[CustomerOrder] = []
    counter = 1

    for customer in customers:
        if customer.channel in {"Retail", "Club", "E-commerce"}:
            preferred = high_velocity + random.sample(all_skus, 8)
        else:
            preferred = random.sample(all_skus, 12)

        for month_back in range(24, 0, -1):
            month_start = today.replace(day=1) - timedelta(days=month_back * 30)
            monthly_orders = random.randint(3, 6)
            for order_index in range(monthly_orders):
                sku = random.choice(preferred if random.random() < 0.82 else all_skus)
                base_qty = random.choice([24, 48, 72, 96, 120, 180])
                if sku in high_velocity:
                    base_qty *= random.choice([2, 3])
                orders.append(
                    CustomerOrder(
                        order_id=f"OTG-ORD-{counter:06d}",
                        customer_id=customer.customer_id,
                        order_date=month_start + timedelta(days=min(27, 3 + order_index * 5)),
                        sku=sku,
                        quantity=base_qty,
                    )
                )
                counter += 1
    return orders


def build_inventory_lots(products: list[Product]) -> list[InventoryLot]:
    today = date.today()
    products_by_sku = {product.sku: product for product in products}
    lots: list[InventoryLot] = []
    counter = 1

    critical_lots = [
        ("OTG-RAM-001", "LA DC", 320, 18),
        ("OTG-CUR-001", "NJ DC", 440, 26),
        ("OTG-RIC-001", "Dallas DC", 280, 42),
        ("OTG-OIL-001", "LA DC", 510, 58),
        ("OTG-SAU-001", "Seattle DC", 620, 82),
    ]
    for sku, warehouse, quantity, days_to_expire in critical_lots:
        product = products_by_sku[sku]
        expiration = today + timedelta(days=days_to_expire)
        received = expiration - timedelta(days=product.shelf_life_days)
        lots.append(
            InventoryLot(
                lot_id=f"OTG-LOT-RISK-{counter:04d}",
                sku=sku,
                warehouse=warehouse,
                quantity_on_hand=quantity,
                received_date=received,
                expiration_date=expiration,
                unit_cost=round(random.uniform(12.5, 42.0), 2),
            )
        )
        counter += 1

    for product in products:
        for _ in range(5):
            warehouse = random.choice(WAREHOUSES)
            age = random.randint(20, min(product.shelf_life_days - 15, 420))
            received = today - timedelta(days=age)
            expiration = received + timedelta(days=product.shelf_life_days)
            lots.append(
                InventoryLot(
                    lot_id=f"OTG-LOT-{counter:05d}",
                    sku=product.sku,
                    warehouse=warehouse,
                    quantity_on_hand=random.randint(48, 1200),
                    received_date=received,
                    expiration_date=expiration,
                    unit_cost=round(random.uniform(7.5, 65.0), 2),
                )
            )
            counter += 1
    return lots


def build_inbound_shipments(products: list[Product]) -> list[InboundShipment]:
    today = date.today()
    shipments: list[InboundShipment] = []
    priority = ["OTG-RAM-001", "OTG-RAM-002", "OTG-CUR-001", "OTG-RIC-001", "OTG-OIL-001"]
    for index, sku in enumerate(priority):
        shipments.append(
            InboundShipment(
                shipment_id=f"OTG-INB-PRIORITY-{index + 1:03d}",
                sku=sku,
                quantity=random.choice([1200, 1800, 2400]),
                eta_date=today + timedelta(days=random.choice([28, 35, 42, 49])),
                origin=random.choice(["Busan", "Incheon"]),
                status=random.choice(["in_transit", "port_hold", "confirmed"]),
            )
        )

    for index in range(20):
        product = random.choice(products)
        shipments.append(
            InboundShipment(
                shipment_id=f"OTG-INB-{index + 1:04d}",
                sku=product.sku,
                quantity=random.randint(360, 2200),
                eta_date=today + timedelta(days=random.randint(7, 65)),
                origin=random.choice(ORIGINS),
                status=random.choice(["planned", "in_transit", "port_hold", "confirmed"]),
            )
        )
    return shipments


def seed() -> dict:
    settings = get_settings()
    session = SessionLocal()
    try:
        for model in [
            ReorderRecommendation,
            WasteRiskAlert,
            InboundShipment,
            CustomerOrder,
            InventoryLot,
            Customer,
            Product,
        ]:
            session.query(model).delete()

        products = build_products()
        customers = build_customers()
        orders = build_orders(products, customers)
        lots = build_inventory_lots(products)
        inbound = build_inbound_shipments(products)

        session.add_all(products)
        session.add_all(customers)
        session.add_all(lots)
        session.add_all(orders)
        session.add_all(inbound)
        session.commit()

        counts = refresh_recommendation_tables(
            session,
            as_of=date.today(),
            lead_time_days=settings.supplier_lead_time_days,
        )
        summary = {
            "products": len(products),
            "inventory_lots": len(lots),
            "customers": len(customers),
            "orders": len(orders),
            "inbound_shipments": len(inbound),
            "refreshed": counts,
        }
        print(f"Seeded Ottogi-style demo dataset: {summary}")
        return summary
    finally:
        session.close()


if __name__ == "__main__":
    seed()
