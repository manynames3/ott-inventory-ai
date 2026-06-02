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


random.seed(42)

WAREHOUSES = ["LA DC", "NJ DC", "Dallas DC", "Seattle DC"]
REGIONS = ["West", "Northeast", "South", "Midwest", "Canada"]
CHANNELS = ["Retail", "Club", "Foodservice", "E-commerce", "Distributor"]
ORIGINS = ["Busan", "Incheon", "Gwangju", "Daegu", "Los Angeles Co-Pack"]

PRODUCT_FAMILIES = [
    ("OTG", "Ready Meals", "On-the-Go"),
    ("KIM", "Fermented", "Kimchi"),
    ("GOJ", "Sauce", "Gochu"),
    ("RAM", "Noodles", "Ramyeon"),
    ("SNK", "Snacks", "Crisp"),
    ("TEA", "Beverage", "Barley Tea"),
    ("BAP", "Rice", "Bap Bowl"),
    ("JJA", "Noodles", "Jjajang"),
    ("BCH", "Pantry", "Banchan"),
    ("FRZ", "Frozen", "Mandu"),
]

ADJECTIVES = ["Hanbi", "Seorae", "Namu", "Dokkae", "Mirim", "Bada", "Soban", "Garu", "Haru", "Jayeon"]
FLAVORS = ["Sesame", "Pear", "Ginger", "Chili", "Plum", "Seaweed", "Garlic", "Soy", "Yuzu", "Roasted"]
FORMS = ["Cups", "Pouches", "Cases", "Trays", "Singles", "Multipacks", "Jars", "Bowls", "Sticks", "Packs"]


def build_products():
    products = []
    for index in range(100):
        prefix, category, base_name = PRODUCT_FAMILIES[index % len(PRODUCT_FAMILIES)]
        number = index // len(PRODUCT_FAMILIES) + 1
        shelf_life = random.choice([120, 180, 240, 365, 540])
        if category == "Frozen":
            shelf_life = random.choice([365, 540])
        if category == "Fermented":
            shelf_life = random.choice([90, 120, 180])
        products.append(
            Product(
                sku=f"{prefix}-{number:03d}",
                name=f"{ADJECTIVES[index % len(ADJECTIVES)]} {FLAVORS[index % len(FLAVORS)]} {base_name} {FORMS[index % len(FORMS)]}",
                category=category,
                case_size=random.choice([6, 8, 10, 12, 24]),
                shelf_life_days=shelf_life,
            )
        )
    return products


def build_customers():
    customers = []
    for index in range(50):
        customers.append(
            Customer(
                customer_id=f"CUST-{index + 1:03d}",
                name=f"{random.choice(['H Mart', 'Pacific', 'Sunrise', 'Freshway', 'Urban', 'Golden'])} "
                f"{random.choice(['Foods', 'Market', 'Kitchen', 'Grocers', 'Trading'])} {index + 1}",
                region=random.choice(REGIONS),
                channel=random.choice(CHANNELS),
            )
        )
    return customers


def build_orders(products, customers):
    orders = []
    today = date.today()
    product_skus = [product.sku for product in products]
    order_counter = 1

    for customer_index, customer in enumerate(customers):
        preferred = random.sample(product_skus, 6)
        if customer_index < 14 and "OTG-001" not in preferred:
            preferred[0] = "OTG-001"

        for month_back in range(24, 0, -1):
            month_start = today.replace(day=1) - timedelta(days=month_back * 30)
            monthly_orders = random.randint(2, 5)
            for _ in range(monthly_orders):
                sku = random.choice(preferred if random.random() < 0.75 else product_skus)
                order_day = month_start + timedelta(days=random.randint(0, 27))
                quantity = random.choice([4, 6, 8, 10, 12, 18, 24, 36, 48])
                orders.append(
                    CustomerOrder(
                        order_id=f"ORD-{order_counter:06d}",
                        customer_id=customer.customer_id,
                        order_date=order_day,
                        sku=sku,
                        quantity=quantity,
                    )
                )
                order_counter += 1
    return orders


def build_inventory_lots(products):
    lots = []
    today = date.today()
    product_by_sku = {product.sku: product for product in products}
    skus = list(product_by_sku.keys())

    for index in range(500):
        sku = random.choice(skus)
        product = product_by_sku[sku]
        warehouse = random.choice(WAREHOUSES)
        received = today - timedelta(days=random.randint(10, min(product.shelf_life_days + 80, 520)))
        expiration = received + timedelta(days=product.shelf_life_days)
        lots.append(
            InventoryLot(
                lot_id=f"LOT-{index + 1:05d}",
                sku=sku,
                warehouse=warehouse,
                quantity_on_hand=random.randint(12, 850),
                received_date=received,
                expiration_date=expiration,
                unit_cost=round(random.uniform(8.0, 62.0), 2),
            )
        )
    return lots


def build_inbound_shipments(products):
    shipments = []
    today = date.today()
    for index in range(20):
        product = random.choice(products)
        shipments.append(
            InboundShipment(
                shipment_id=f"INB-{index + 1:04d}",
                sku=product.sku,
                quantity=random.randint(120, 1800),
                eta_date=today + timedelta(days=random.randint(5, 55)),
                origin=random.choice(ORIGINS),
                status=random.choice(["planned", "in_transit", "port_hold", "confirmed"]),
            )
        )
    return shipments


def seed() -> None:
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
        print(
            "Seeded StockSense AI with "
            f"{len(products)} SKUs, {len(lots)} lots, {len(customers)} customers, "
            f"{len(orders)} orders, {len(inbound)} inbound shipments. Refreshed {counts}."
        )
    finally:
        session.close()


if __name__ == "__main__":
    seed()

