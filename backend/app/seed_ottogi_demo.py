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
REGION_WAREHOUSE = {
    "West": ["LA DC", "Seattle DC"],
    "Northeast": ["NJ DC"],
    "South": ["Dallas DC", "LA DC"],
    "Midwest": ["Dallas DC", "NJ DC"],
    "National": WAREHOUSES,
    "Canada": ["Seattle DC", "NJ DC"],
}
CHANNEL_ORDER_PROFILE = {
    "Retail": {"orders": (3, 5), "qty": [48, 72, 96, 120, 180, 240]},
    "Club": {"orders": (2, 4), "qty": [180, 240, 360, 480, 720]},
    "Distributor": {"orders": (3, 6), "qty": [120, 180, 240, 360, 540]},
    "Foodservice": {"orders": (2, 4), "qty": [24, 48, 72, 96, 144]},
    "E-commerce": {"orders": (4, 7), "qty": [12, 24, 48, 72, 96]},
}
CATEGORY_COST_RANGE = {
    "Noodles": (14.0, 23.0),
    "Curry": (18.0, 34.0),
    "Ready Rice": (19.0, 38.0),
    "Ready Meals": (22.0, 42.0),
    "Sauce": (16.0, 31.0),
    "Oil & Vinegar": (24.0, 58.0),
    "Seasoning": (12.0, 24.0),
    "Mix & Powder": (15.0, 30.0),
    "Soup & HMR": (18.0, 36.0),
    "Frozen": (28.0, 65.0),
    "Snacks": (10.0, 21.0),
    "Beverage": (13.0, 29.0),
    "Canned": (21.0, 44.0),
    "Seaweed": (12.0, 26.0),
}
CATEGORY_SEASONALITY = {
    "Noodles": {11: 1.2, 12: 1.28, 1: 1.25, 2: 1.18, 7: 0.92},
    "Soup & HMR": {11: 1.28, 12: 1.35, 1: 1.3, 2: 1.2, 6: 0.86, 7: 0.82},
    "Curry": {8: 1.18, 9: 1.2, 10: 1.12},
    "Sauce": {5: 1.12, 6: 1.18, 7: 1.2, 8: 1.12},
    "Oil & Vinegar": {9: 1.12, 10: 1.1, 11: 1.08},
    "Ready Rice": {8: 1.12, 9: 1.15, 1: 1.08},
    "Frozen": {11: 1.18, 12: 1.24, 1: 1.16},
    "Beverage": {6: 1.18, 7: 1.28, 8: 1.22},
}

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


def _month_start(today: date, months_back: int) -> date:
    month_index = today.year * 12 + today.month - 1 - months_back
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def _category_multiplier(category: str, month: int) -> float:
    return CATEGORY_SEASONALITY.get(category, {}).get(month, 1.0)


def _unit_cost(category: str) -> float:
    low, high = CATEGORY_COST_RANGE.get(category, (12.0, 38.0))
    return round(random.uniform(low, high), 2)


def _weighted_warehouse(region: str) -> str:
    preferred = REGION_WAREHOUSE.get(region, WAREHOUSES)
    if random.random() < 0.78:
        return random.choice(preferred)
    return random.choice(WAREHOUSES)


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
    products_by_sku = {product.sku: product for product in products}
    all_skus = [product.sku for product in products]
    category_skus: dict[str, list[str]] = {}
    for product in products:
        category_skus.setdefault(product.category, []).append(product.sku)
    orders: list[CustomerOrder] = []
    counter = 1

    for customer in customers:
        if customer.channel in {"Retail", "Club"}:
            pool = (
                category_skus["Noodles"]
                + category_skus["Ready Rice"]
                + category_skus["Curry"]
                + category_skus["Sauce"]
                + category_skus["Seaweed"]
            )
            preferred = high_velocity + random.sample(pool, 10)
        elif customer.channel == "E-commerce":
            pool = category_skus["Noodles"] + category_skus["Ready Rice"] + category_skus["Snacks"] + category_skus["Beverage"]
            preferred = high_velocity[:3] + random.sample(pool, 9)
        elif customer.channel == "Foodservice":
            pool = category_skus["Sauce"] + category_skus["Oil & Vinegar"] + category_skus["Mix & Powder"] + category_skus["Frozen"]
            preferred = random.sample(pool, 12)
        else:
            preferred = high_velocity + random.sample(all_skus, 14)

        for month_back in range(24, 0, -1):
            month_start = _month_start(today, month_back)
            profile = CHANNEL_ORDER_PROFILE[customer.channel]
            monthly_orders = random.randint(*profile["orders"])
            if customer.channel == "Distributor" and random.random() < 0.12:
                monthly_orders += 2
            for order_index in range(monthly_orders):
                sku = random.choice(preferred if random.random() < 0.82 else all_skus)
                product = products_by_sku[sku]
                base_qty = random.choice(profile["qty"])
                if sku in high_velocity:
                    base_qty *= random.choice([2, 2, 3])
                seasonal_qty = int(round(base_qty * _category_multiplier(product.category, month_start.month)))
                promo_lift = 1.35 if customer.channel in {"Club", "E-commerce"} and random.random() < 0.08 else 1.0
                quantity = max(product.case_size, int(round(seasonal_qty * promo_lift / product.case_size)) * product.case_size)
                order_day = min(27, 2 + order_index * 4 + random.randint(0, 3))
                orders.append(
                    CustomerOrder(
                        order_id=f"OTG-ORD-{counter:06d}",
                        customer_id=customer.customer_id,
                        order_date=month_start + timedelta(days=order_day),
                        sku=sku,
                        quantity=quantity,
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
        ("OTG-RAM-001", "LA DC", 840, 18),
        ("OTG-CUR-001", "NJ DC", 720, 26),
        ("OTG-RIC-001", "Dallas DC", 640, 42),
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
                unit_cost=_unit_cost(product.category),
            )
        )
        counter += 1

    for product in products:
        for _ in range(5):
            warehouse = _weighted_warehouse("West" if product.category in {"Noodles", "Ready Rice", "Seaweed"} else random.choice(list(REGION_WAREHOUSE)))
            if random.random() < 0.18:
                age = random.randint(max(20, product.shelf_life_days - 110), max(21, product.shelf_life_days - 20))
            else:
                age = random.randint(20, min(product.shelf_life_days - 120, 360)) if product.shelf_life_days > 180 else random.randint(20, product.shelf_life_days - 45)
            received = today - timedelta(days=age)
            expiration = received + timedelta(days=product.shelf_life_days)
            if product.category in {"Noodles", "Curry", "Ready Rice", "Oil & Vinegar"}:
                quantity = random.choice([360, 480, 600, 720, 960, 1200, 1440])
            elif product.category in {"Frozen", "Sauce", "Soup & HMR"}:
                quantity = random.choice([144, 240, 360, 480, 720, 960])
            else:
                quantity = random.choice([48, 96, 144, 240, 360, 480])
            lots.append(
                InventoryLot(
                    lot_id=f"OTG-LOT-{counter:05d}",
                    sku=product.sku,
                    warehouse=warehouse,
                    quantity_on_hand=quantity,
                    received_date=received,
                    expiration_date=expiration,
                    unit_cost=_unit_cost(product.category),
                )
            )
            counter += 1
    return lots


def build_inbound_shipments(products: list[Product]) -> list[InboundShipment]:
    today = date.today()
    shipments: list[InboundShipment] = []
    products_by_sku = {product.sku: product for product in products}
    priority = ["OTG-RAM-001", "OTG-RAM-002", "OTG-CUR-001", "OTG-RIC-001", "OTG-OIL-001"]
    for index, sku in enumerate(priority):
        product = products_by_sku[sku]
        quantity = random.choice([60, 90, 120, 150]) * product.case_size
        shipments.append(
            InboundShipment(
                shipment_id=f"OTG-INB-PRIORITY-{index + 1:03d}",
                sku=sku,
                quantity=quantity,
                eta_date=today + timedelta(days=random.choice([28, 35, 42, 49])),
                origin=random.choice(["Busan", "Incheon"]),
                status=random.choice(["in_transit", "port_hold", "confirmed"]),
            )
        )

    for index in range(20):
        product = random.choice(products)
        quantity = random.choice([30, 45, 60, 90, 120]) * product.case_size
        shipments.append(
            InboundShipment(
                shipment_id=f"OTG-INB-{index + 1:04d}",
                sku=product.sku,
                quantity=quantity,
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
