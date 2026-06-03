from __future__ import annotations

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import declarative_base, relationship


Base = declarative_base()


class Product(Base):
    __tablename__ = "products"

    sku = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(120), nullable=False)
    case_size = Column(Integer, nullable=False)
    shelf_life_days = Column(Integer, nullable=False)

    lots = relationship("InventoryLot", back_populates="product")
    orders = relationship("CustomerOrder", back_populates="product")


class InventoryLot(Base):
    __tablename__ = "inventory_lots"

    lot_id = Column(String(96), primary_key=True, index=True)
    sku = Column(String(64), ForeignKey("products.sku"), nullable=False, index=True)
    warehouse = Column(String(120), nullable=False, index=True)
    quantity_on_hand = Column(Integer, nullable=False)
    received_date = Column(Date, nullable=False)
    expiration_date = Column(Date, nullable=False, index=True)
    unit_cost = Column(Float, nullable=False)

    product = relationship("Product", back_populates="lots")


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(String(96), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    region = Column(String(120), nullable=False)
    channel = Column(String(120), nullable=False)

    orders = relationship("CustomerOrder", back_populates="customer")


class CustomerOrder(Base):
    __tablename__ = "orders"

    order_id = Column(String(96), primary_key=True, index=True)
    customer_id = Column(String(96), ForeignKey("customers.customer_id"), nullable=False, index=True)
    order_date = Column(Date, nullable=False, index=True)
    sku = Column(String(64), ForeignKey("products.sku"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)

    customer = relationship("Customer", back_populates="orders")
    product = relationship("Product", back_populates="orders")


class InboundShipment(Base):
    __tablename__ = "inbound_shipments"

    shipment_id = Column(String(96), primary_key=True, index=True)
    sku = Column(String(64), ForeignKey("products.sku"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    eta_date = Column(Date, nullable=False, index=True)
    origin = Column(String(160), nullable=False)
    status = Column(String(80), nullable=False)


class ReorderRecommendation(Base):
    __tablename__ = "reorder_recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sku = Column(String(64), ForeignKey("products.sku"), nullable=False, index=True)
    warehouse = Column(String(120), nullable=False, index=True)
    recommended_order_qty = Column(Integer, nullable=False)
    reorder_by_date = Column(Date, nullable=False, index=True)
    reason = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False)
    status = Column(String(80), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class WasteRiskAlert(Base):
    __tablename__ = "waste_risk_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sku = Column(String(64), ForeignKey("products.sku"), nullable=False, index=True)
    lot_id = Column(String(96), ForeignKey("inventory_lots.lot_id"), nullable=False, index=True)
    warehouse = Column(String(120), nullable=False, index=True)
    quantity_at_risk = Column(Integer, nullable=False)
    expiration_date = Column(Date, nullable=False, index=True)
    suggested_action = Column(Text, nullable=False)
    risk_bucket = Column(String(80), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ActionReview(Base):
    __tablename__ = "action_reviews"

    action_key = Column(String(512), primary_key=True)
    status = Column(String(32), nullable=False, index=True)
    note = Column(Text, nullable=False, default="")
    action_snapshot = Column(Text, nullable=False, default="{}")
    updated_by = Column(String(255), nullable=False)
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
