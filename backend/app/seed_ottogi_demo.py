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

PRODUCT_CATALOG = [
    ("OTG-RAM-001", "Ottogi Jin Ramen Spicy Multi-Pack", "Noodles", 20, 270),
    ("OTG-RAM-002", "Ottogi Jin Ramen Mild Multi-Pack", "Noodles", 20, 270),
    ("OTG-RAM-003", "Ottogi Jin Ramen Veggie Multi-Pack", "Noodles", 20, 270),
    ("OTG-RAM-004", "Ottogi Sesame Ramen with Egg Block", "Noodles", 20, 270),
    ("OTG-RAM-005", "Ottogi Cheese Ramen Multi-Pack", "Noodles", 20, 270),
    ("OTG-RAM-006", "Ottogi Yeul Ramen Hot Pepper", "Noodles", 20, 270),
    ("OTG-RAM-007", "Ottogi Snack Ramen Multi-Pack", "Noodles", 20, 270),
    ("OTG-RAM-008", "Ottogi Ramen Sari Plain Noodle", "Noodles", 40, 270),
    ("OTG-RAM-009", "Ottogi Jin Jjambbong Spicy Seafood", "Noodles", 16, 270),
    ("OTG-RAM-010", "Ottogi Jin Jjajang Black Bean Noodle", "Noodles", 16, 270),
    ("OTG-RAM-011", "Ottogi Spaghetti Ramen", "Noodles", 16, 270),
    ("OTG-RAM-012", "Ottogi Curry Ramen", "Noodles", 16, 270),
    ("OTG-RAM-013", "Ottogi Odongtong Myon Seafood Noodle", "Noodles", 16, 270),
    ("OTG-RAM-014", "Ottogi Buckwheat Bibim Noodle", "Noodles", 16, 240),
    ("OTG-RAM-015", "Ottogi Cup Noodle Spicy", "Noodles", 12, 240),
    ("OTG-RAM-016", "Ottogi Cup Noodle Udon", "Noodles", 12, 240),
    ("OTG-CUR-001", "Ottogi 3 Minute Curry Mild Pouch", "Curry", 24, 365),
    ("OTG-CUR-002", "Ottogi 3 Minute Curry Medium Pouch", "Curry", 24, 365),
    ("OTG-CUR-003", "Ottogi 3 Minute Curry Hot Pouch", "Curry", 24, 365),
    ("OTG-CUR-004", "Ottogi 3 Minute Jjajang Sauce Pouch", "Curry", 24, 365),
    ("OTG-CUR-005", "Ottogi Vermont Curry Mild Powder", "Curry", 12, 540),
    ("OTG-CUR-006", "Ottogi Vermont Curry Hot Powder", "Curry", 12, 540),
    ("OTG-CUR-007", "Ottogi Baekse Curry Powder", "Curry", 12, 540),
    ("OTG-CUR-008", "Ottogi 3-Day Aged Curry Powder", "Curry", 12, 540),
    ("OTG-CUR-009", "Ottogi Butter Chicken Curry Pouch", "Curry", 24, 365),
    ("OTG-CUR-010", "Ottogi Honey Mango Curry Pouch", "Curry", 24, 365),
    ("OTG-CUR-011", "Ottogi Hash Rice Sauce Pouch", "Curry", 24, 365),
    ("OTG-CUR-012", "Ottogi Curry Powder Mild", "Curry", 12, 540),
    ("OTG-RIC-001", "Ottogi Cooked Rice White Bowl", "Ready Rice", 18, 240),
    ("OTG-RIC-002", "Ottogi Cooked Rice Brown Bowl", "Ready Rice", 18, 240),
    ("OTG-RIC-003", "Ottogi Cooked Rice Kimchi Tuna Sauce", "Ready Rice", 12, 240),
    ("OTG-RIC-004", "Ottogi Cooked Rice Jeonju Bibimbap", "Ready Rice", 12, 240),
    ("OTG-RIC-005", "Ottogi Cooked Rice Teriyaki Tuna Mayo", "Ready Rice", 12, 240),
    ("OTG-RIC-006", "Ottogi Cooked Rice Spicy Octopus Sauce", "Ready Rice", 12, 240),
    ("OTG-RIC-007", "Ottogi Cooked Rice Bean Sprout Pollock", "Ready Rice", 12, 240),
    ("OTG-RIC-008", "Ottogi Cooked Rice Hamburg Steak", "Ready Rice", 12, 240),
    ("OTG-RIC-009", "Ottogi Cooked Rice Soybean Paste Beef", "Ready Rice", 12, 240),
    ("OTG-RIC-010", "Ottogi 3 Minute Hamburg Steak", "Ready Meals", 24, 365),
    ("OTG-RIC-011", "Ottogi 3 Minute Meatball Sweet Sour", "Ready Meals", 24, 365),
    ("OTG-RIC-012", "Ottogi 3 Minute Barbecue Chicken", "Ready Meals", 24, 365),
    ("OTG-SAU-001", "Ottogi Tomato Ketchup", "Sauce", 12, 540),
    ("OTG-SAU-002", "Ottogi Mayonnaise", "Sauce", 12, 365),
    ("OTG-SAU-003", "Ottogi Gold Mayonnaise", "Sauce", 12, 365),
    ("OTG-SAU-004", "Ottogi Tonkatsu Sauce", "Sauce", 12, 540),
    ("OTG-SAU-005", "Ottogi Worcestershire Sauce", "Sauce", 12, 540),
    ("OTG-SAU-006", "Ottogi Tartar Sauce", "Sauce", 12, 365),
    ("OTG-SAU-007", "Ottogi Honey Mustard", "Sauce", 12, 365),
    ("OTG-SAU-008", "Ottogi Sesame Dressing", "Sauce", 12, 365),
    ("OTG-SAU-009", "Ottogi Korean BBQ Bulgogi Sauce", "Sauce", 12, 540),
    ("OTG-SAU-010", "Ottogi Gochujang Sauce", "Sauce", 12, 540),
    ("OTG-SAU-011", "Ottogi Jjajang Sauce", "Sauce", 24, 365),
    ("OTG-SAU-012", "Ottogi Spaghetti Tomato Sauce", "Sauce", 12, 540),
    ("OTG-SAU-013", "Ottogi Pizza Sauce", "Sauce", 12, 540),
    ("OTG-SAU-014", "Ottogi Sweet Chili Sauce", "Sauce", 12, 540),
    ("OTG-SAU-015", "Ottogi Black Pepper Steak Sauce", "Sauce", 12, 540),
    ("OTG-SAU-016", "Ottogi Pickling Sauce Base", "Sauce", 12, 540),
    ("OTG-OIL-001", "Ottogi Sesame Oil", "Oil & Vinegar", 12, 540),
    ("OTG-OIL-002", "Ottogi Perilla Oil", "Oil & Vinegar", 12, 365),
    ("OTG-OIL-003", "Ottogi Roasted Sesame Oil", "Oil & Vinegar", 12, 540),
    ("OTG-OIL-004", "Ottogi Canola Oil", "Oil & Vinegar", 12, 540),
    ("OTG-OIL-005", "Ottogi Corn Oil", "Oil & Vinegar", 12, 540),
    ("OTG-OIL-006", "Ottogi Cooking Oil", "Oil & Vinegar", 12, 540),
    ("OTG-VNG-001", "Ottogi Apple Vinegar", "Oil & Vinegar", 12, 540),
    ("OTG-VNG-002", "Ottogi Brown Rice Vinegar", "Oil & Vinegar", 12, 540),
    ("OTG-VNG-003", "Ottogi Brewed Vinegar", "Oil & Vinegar", 12, 540),
    ("OTG-VNG-004", "Ottogi White Vinegar", "Oil & Vinegar", 12, 540),
    ("OTG-SSN-001", "Ottogi Roasted Sesame Seeds", "Seasoning", 24, 365),
    ("OTG-SSN-002", "Ottogi Black Sesame Seeds", "Seasoning", 24, 365),
    ("OTG-MIX-001", "Ottogi Frying Mix", "Mix & Powder", 10, 365),
    ("OTG-MIX-002", "Ottogi Pancake Mix", "Mix & Powder", 10, 365),
    ("OTG-MIX-003", "Ottogi Tempura Mix", "Mix & Powder", 10, 365),
    ("OTG-MIX-004", "Ottogi Hotcake Mix", "Mix & Powder", 10, 365),
    ("OTG-MIX-005", "Ottogi Bread Crumbs", "Mix & Powder", 12, 365),
    ("OTG-MIX-006", "Ottogi Corn Soup Powder", "Mix & Powder", 12, 365),
    ("OTG-MIX-007", "Ottogi Cream Soup Powder", "Mix & Powder", 12, 365),
    ("OTG-MIX-008", "Ottogi Onion Soup Powder", "Mix & Powder", 12, 365),
    ("OTG-MIX-009", "Ottogi Beef Stock Powder", "Mix & Powder", 12, 365),
    ("OTG-MIX-010", "Ottogi Anchovy Stock Powder", "Mix & Powder", 12, 365),
    ("OTG-MIX-011", "Ottogi Kimchi Seasoning Powder", "Mix & Powder", 12, 365),
    ("OTG-MIX-012", "Ottogi Curry Flake", "Mix & Powder", 12, 365),
    ("OTG-SOU-001", "Ottogi Seaweed Soup", "Soup & HMR", 12, 365),
    ("OTG-SOU-002", "Ottogi Beef Bone Soup", "Soup & HMR", 12, 365),
    ("OTG-SOU-003", "Ottogi Dried Pollack Soup", "Soup & HMR", 12, 365),
    ("OTG-SOU-004", "Ottogi Soybean Paste Stew", "Soup & HMR", 12, 365),
    ("OTG-SOU-005", "Ottogi Kimchi Stew", "Soup & HMR", 12, 365),
    ("OTG-SOU-006", "Ottogi Rice Cake Soup Bowl", "Soup & HMR", 12, 240),
    ("OTG-SOU-007", "Ottogi Beef Bulgogi Bowl", "Soup & HMR", 12, 240),
    ("OTG-SOU-008", "Ottogi Pork Kimchi Bowl", "Soup & HMR", 12, 240),
    ("OTG-SOU-009", "Ottogi Spicy Chicken Bowl", "Soup & HMR", 12, 240),
    ("OTG-SOU-010", "Ottogi Japchae Bowl", "Soup & HMR", 12, 240),
    ("OTG-FRZ-001", "Ottogi Mandu Tray Original", "Frozen", 8, 540),
    ("OTG-FRZ-002", "Ottogi Kimchi Mandu Tray", "Frozen", 8, 540),
    ("OTG-FRZ-003", "Ottogi Vegetable Mandu Tray", "Frozen", 8, 540),
    ("OTG-FRZ-004", "Ottogi Frozen Cheese Pizza", "Frozen", 8, 540),
    ("OTG-FRZ-005", "Ottogi Frozen Bulgogi Pizza", "Frozen", 8, 540),
    ("OTG-FRZ-006", "Ottogi Shrimp Fried Rice", "Frozen", 12, 540),
    ("OTG-FRZ-007", "Ottogi Kimchi Fried Rice", "Frozen", 12, 540),
    ("OTG-FRZ-008", "Ottogi Curry Fried Rice", "Frozen", 12, 540),
    ("OTG-SNK-001", "Ottogi Ppushu Ppushu Bulgogi Snack Noodle", "Snacks", 12, 300),
    ("OTG-SNK-002", "Ottogi Ppushu Ppushu Tteokbokki Snack Noodle", "Snacks", 12, 300),
    ("OTG-TEA-001", "Ottogi Barley Tea", "Beverage", 20, 540),
    ("OTG-TEA-002", "Ottogi Corn Tea", "Beverage", 20, 540),
    ("OTG-TEA-003", "Ottogi Honey Citron Tea", "Beverage", 12, 540),
    ("OTG-TEA-004", "Ottogi Jujube Tea", "Beverage", 12, 540),
    ("OTG-TEA-005", "Ottogi Ginger Tea", "Beverage", 12, 540),
    ("OTG-CAN-001", "Ottogi Hot Pepper Tuna", "Canned", 24, 540),
    ("OTG-CAN-002", "Ottogi Vegetable Tuna", "Canned", 24, 540),
    ("OTG-CAN-003", "Ottogi Light Tuna", "Canned", 24, 540),
    ("OTG-SEA-001", "Ottogi Roasted Seaweed Snack", "Seaweed", 24, 300),
    ("OTG-SEA-002", "Ottogi Seaweed Crisps", "Seaweed", 24, 300),
]

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
    return [
        Product(
            sku=sku,
            name=name,
            category=category,
            case_size=case_size,
            shelf_life_days=shelf_life_days,
        )
        for sku, name, category, case_size, shelf_life_days in PRODUCT_CATALOG
    ]


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
