from __future__ import annotations

import csv
import json
import math
import os
import statistics
import time
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from io import BytesIO, StringIO
from typing import Any, Dict, Iterable, List, Tuple
from urllib.parse import unquote_plus
from xml.etree import ElementTree as ET

import boto3


s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")

TENANT_PK = "tenant#default"
DATE_STYLE_IDS = set(range(14, 23)) | {27, 30, 36, 45, 46, 47, 50, 57}

REQUIRED_COLUMNS = {
    "products": ["sku", "name", "category", "case_size", "shelf_life_days"],
    "inventory_lots": [
        "lot_id",
        "sku",
        "warehouse",
        "quantity_on_hand",
        "received_date",
        "expiration_date",
        "unit_cost",
    ],
    "customers": ["customer_id", "name", "region", "channel"],
    "orders": ["order_id", "customer_id", "order_date", "sku", "quantity"],
    "inbound_shipments": ["shipment_id", "sku", "quantity", "eta_date", "origin", "status"],
}

KEY_FIELDS = {
    "products": "sku",
    "inventory_lots": "lot_id",
    "customers": "customer_id",
    "orders": "order_id",
    "inbound_shipments": "shipment_id",
}

NUMERIC_FIELDS = {
    "case_size",
    "shelf_life_days",
    "quantity_on_hand",
    "unit_cost",
    "quantity",
}

DATE_FIELDS = {"received_date", "expiration_date", "order_date", "eta_date"}


def _record_pk(entity: str) -> str:
    return f"{TENANT_PK}#entity#{entity}"


def _now() -> int:
    return int(time.time())


def _put_import_status(bucket: str, key: str, status: str, message: str, **extra: Any) -> None:
    now = _now()
    payload = {
        "bucket": bucket,
        "key": key,
        "status": status,
        "message": message,
        "updated_at_epoch": now,
        **extra,
    }
    dynamodb.put_item(
        TableName=os.environ["AWS_DYNAMODB_IMPORTS_TABLE"],
        Item={
            "pk": {"S": f"import#{bucket}#{key}"},
            "sk": {"S": "status"},
            "status": {"S": status},
            "data": {"S": json.dumps(payload, separators=(",", ":"), default=str)},
            "ttl_epoch": {"N": str(now + 90 * 24 * 60 * 60)},
        },
    )


def _col_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    result = 0
    for letter in letters:
        result = result * 26 + (ord(letter.upper()) - 64)
    return max(result - 1, 0)


def _xlsx_date(serial: str) -> str:
    try:
        return (datetime(1899, 12, 30) + timedelta(days=float(serial))).date().isoformat()
    except Exception:
        return serial


def _xlsx_shared_strings(archive: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    values = []
    for item in root.findall("m:si", ns):
        texts = [node.text or "" for node in item.findall(".//m:t", ns)]
        values.append("".join(texts))
    return values


def _xlsx_date_styles(archive: zipfile.ZipFile) -> set[int]:
    if "xl/styles.xml" not in archive.namelist():
        return set()
    root = ET.fromstring(archive.read("xl/styles.xml"))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    styles = set()
    cell_xfs = root.find("m:cellXfs", ns)
    if cell_xfs is None:
        return styles
    for index, xf in enumerate(cell_xfs.findall("m:xf", ns)):
        num_fmt_id = int(xf.attrib.get("numFmtId", "0"))
        if num_fmt_id in DATE_STYLE_IDS:
            styles.add(index)
    return styles


def _parse_xlsx(content: bytes) -> List[Dict[str, str]]:
    with zipfile.ZipFile(BytesIO(content)) as archive:
        shared = _xlsx_shared_strings(archive)
        date_styles = _xlsx_date_styles(archive)
        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in archive.namelist():
            sheets = [name for name in archive.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")]
            if not sheets:
                return []
            sheet_name = sheets[0]
        root = ET.fromstring(archive.read(sheet_name))

    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    matrix: List[List[str]] = []
    for row in root.findall(".//m:row", ns):
        values: List[str] = []
        for cell in row.findall("m:c", ns):
            index = _col_index(cell.attrib.get("r", "A1"))
            while len(values) <= index:
                values.append("")
            cell_type = cell.attrib.get("t")
            style = int(cell.attrib.get("s", "0"))
            if cell_type == "inlineStr":
                text = "".join(node.text or "" for node in cell.findall(".//m:t", ns))
            else:
                raw = (cell.findtext("m:v", default="", namespaces=ns) or "").strip()
                if cell_type == "s" and raw:
                    text = shared[int(raw)] if int(raw) < len(shared) else raw
                elif raw and style in date_styles:
                    text = _xlsx_date(raw)
                else:
                    text = raw
            values[index] = text
        if any(value != "" for value in values):
            matrix.append(values)
    if not matrix:
        return []
    headers = [str(value).strip() for value in matrix[0]]
    return [
        {headers[i]: row[i].strip() if i < len(row) else "" for i in range(len(headers))}
        for row in matrix[1:]
        if any(cell.strip() for cell in row)
    ]


def _parse_csv(content: bytes) -> List[Dict[str, str]]:
    text = content.decode("utf-8-sig")
    return [dict(row) for row in csv.DictReader(StringIO(text))]


def _to_number(value: Any) -> int | float:
    text = str(value or "").strip()
    if text == "":
        return 0
    number = float(text.replace(",", ""))
    return int(number) if number.is_integer() else number


def _to_date(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    try:
        numeric = float(text)
        if numeric > 10000:
            return _xlsx_date(text)
    except ValueError:
        pass
    return text[:10]


def _normalize(entity: str, rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    required = REQUIRED_COLUMNS[entity]
    if not rows:
        return [], ["File contains no data rows."]
    missing = [column for column in required if column not in rows[0]]
    if missing:
        return [], [f"Missing required columns: {', '.join(missing)}"]
    normalized = []
    errors = []
    key_field = KEY_FIELDS[entity]
    for index, row in enumerate(rows, start=2):
        item = {column: row.get(column, "") for column in required}
        for column, value in item.items():
            if str(value or "").strip() == "":
                errors.append(f"Row {index} is missing required value for {column}.")
        for field in NUMERIC_FIELDS.intersection(item.keys()):
            try:
                item[field] = _to_number(item[field])
            except ValueError:
                errors.append(f"Row {index} has invalid number for {field}: {item[field]}.")
        for field in DATE_FIELDS.intersection(item.keys()):
            item[field] = _to_date(item[field])
            if item[field]:
                try:
                    datetime.strptime(str(item[field]), "%Y-%m-%d")
                except ValueError:
                    errors.append(f"Row {index} has invalid date for {field}: {item[field]}. Use YYYY-MM-DD.")
        if not str(item.get(key_field, "")).strip():
            errors.append(f"Row {index} is missing {key_field}.")
            continue
        normalized.append(item)
    return ([] if errors else normalized), errors


def _delete_existing(entity: str) -> None:
    pk = _record_pk(entity)
    while True:
        response = dynamodb.query(
            TableName=os.environ["AWS_DYNAMODB_RECORDS_TABLE"],
            KeyConditionExpression="pk = :pk",
            ExpressionAttributeValues={":pk": {"S": pk}},
            ProjectionExpression="pk, sk",
        )
        items = response.get("Items", [])
        if not items:
            return
        with _BatchWriter(os.environ["AWS_DYNAMODB_RECORDS_TABLE"]) as batch:
            for item in items:
                batch.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})


class _BatchWriter:
    def __init__(self, table_name: str):
        self.table_name = table_name
        self.requests: List[Dict[str, Any]] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.flush()

    def put_item(self, Item: Dict[str, Any]) -> None:
        self.requests.append({"PutRequest": {"Item": Item}})
        if len(self.requests) == 25:
            self.flush()

    def delete_item(self, Key: Dict[str, Any]) -> None:
        self.requests.append({"DeleteRequest": {"Key": Key}})
        if len(self.requests) == 25:
            self.flush()

    def flush(self) -> None:
        if not self.requests:
            return
        requests = self.requests
        self.requests = []
        response = dynamodb.batch_write_item(RequestItems={self.table_name: requests})
        unprocessed = response.get("UnprocessedItems", {}).get(self.table_name, [])
        while unprocessed:
            time.sleep(0.2)
            response = dynamodb.batch_write_item(RequestItems={self.table_name: unprocessed})
            unprocessed = response.get("UnprocessedItems", {}).get(self.table_name, [])


def _write_records(entity: str, rows: List[Dict[str, Any]]) -> None:
    pk = _record_pk(entity)
    key_field = KEY_FIELDS[entity]
    _delete_existing(entity)
    with _BatchWriter(os.environ["AWS_DYNAMODB_RECORDS_TABLE"]) as batch:
        for row in rows:
            batch.put_item(
                Item={
                    "pk": {"S": pk},
                    "sk": {"S": str(row[key_field])},
                    "data": {"S": json.dumps(row, separators=(",", ":"), default=str)},
                    "updated_at_epoch": {"N": str(_now())},
                }
            )


def _read_records(entity: str) -> List[Dict[str, Any]]:
    rows = []
    start_key = None
    while True:
        kwargs: Dict[str, Any] = {
            "TableName": os.environ["AWS_DYNAMODB_RECORDS_TABLE"],
            "KeyConditionExpression": "pk = :pk",
            "ExpressionAttributeValues": {":pk": {"S": _record_pk(entity)}},
        }
        if start_key:
            kwargs["ExclusiveStartKey"] = start_key
        response = dynamodb.query(**kwargs)
        rows.extend(json.loads(item["data"]["S"]) for item in response.get("Items", []))
        start_key = response.get("LastEvaluatedKey")
        if not start_key:
            return rows


def _put_view(sk: str, data: Dict[str, Any]) -> None:
    dynamodb.put_item(
        TableName=os.environ["AWS_DYNAMODB_VIEWS_TABLE"],
        Item={
            "pk": {"S": TENANT_PK},
            "sk": {"S": sk},
            "data": {"S": json.dumps(data, separators=(",", ":"), default=str)},
            "updated_at_epoch": {"N": str(_now())},
        },
    )


def _as_date(value: Any) -> date:
    if isinstance(value, date):
        return value
    return datetime.strptime(_to_date(value), "%Y-%m-%d").date()


def _days_to_exp(expiration_date: Any, today: date) -> int:
    return (_as_date(expiration_date) - today).days


def _expiration_flags(expiration_date: Any, today: date) -> Dict[str, str | int]:
    days = _days_to_exp(expiration_date, today)
    if days < 0:
        return {"days_to_expiration": days, "bucket": "expired", "risk_level": "critical", "suggested_action": "Quarantine lot and review write-off exposure."}
    if days <= 30:
        return {"days_to_expiration": days, "bucket": "0-30 days", "risk_level": "critical", "suggested_action": "Priority allocate to fastest-turning customers or discount immediately."}
    if days <= 60:
        return {"days_to_expiration": days, "bucket": "31-60 days", "risk_level": "high", "suggested_action": "Transfer to higher-demand warehouse or attach to near-term promotions."}
    if days <= 90:
        return {"days_to_expiration": days, "bucket": "61-90 days", "risk_level": "medium", "suggested_action": "Flag for priority allocation before newer lots are shipped."}
    return {"days_to_expiration": days, "bucket": "90+ days", "risk_level": "normal", "suggested_action": "Use standard FEFO allocation."}


def _active_lots(lots: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [lot for lot in lots if int(float(lot.get("quantity_on_hand", 0) or 0)) > 0]


def _fefo(lots: List[Dict[str, Any]], today: date) -> List[Dict[str, Any]]:
    groups: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for lot in _active_lots(lots):
        groups[(str(lot["sku"]), str(lot["warehouse"]))].append(lot)
    recommendations = []
    for (sku, warehouse), group in sorted(groups.items()):
        group = sorted(group, key=lambda item: (_to_date(item["expiration_date"]), _to_date(item.get("received_date", "")), str(item["lot_id"])))
        first = group[0]
        flags = _expiration_flags(first["expiration_date"], today)
        if len(group) > 1:
            gap = _days_to_exp(group[1]["expiration_date"], today) - int(flags["days_to_expiration"])
            reason = f"Ship Lot {first['lot_id']} first because it expires {gap} days before Lot {group[1]['lot_id']}."
        else:
            reason = f"Ship Lot {first['lot_id']} first because it is the only available lot for this SKU and warehouse."
        recommendations.append(
            {
                "sku": sku,
                "warehouse": warehouse,
                "ship_first_lot": first["lot_id"],
                "expiration_date": _to_date(first["expiration_date"]),
                "days_to_expiration": flags["days_to_expiration"],
                "risk_bucket": flags["bucket"],
                "suggested_action": flags["suggested_action"],
                "reason": reason,
            }
        )
    return recommendations


def _waste_alerts(lots: List[Dict[str, Any]], today: date) -> List[Dict[str, Any]]:
    alerts = []
    for lot in _active_lots(lots):
        flags = _expiration_flags(lot["expiration_date"], today)
        if int(flags["days_to_expiration"]) <= 90:
            alerts.append(
                {
                    "sku": lot["sku"],
                    "lot_id": lot["lot_id"],
                    "warehouse": lot["warehouse"],
                    "quantity_at_risk": int(float(lot.get("quantity_on_hand", 0) or 0)),
                    "expiration_date": _to_date(lot["expiration_date"]),
                    "risk_bucket": flags["bucket"],
                    "suggested_action": flags["suggested_action"],
                }
            )
    return sorted(alerts, key=lambda item: (item["expiration_date"], item["sku"], item["warehouse"]))


def _daily_demand(orders: List[Dict[str, Any]], sku: str, today: date, history_days: int = 90) -> List[float]:
    quantities = defaultdict(float)
    start = today - timedelta(days=history_days - 1)
    for order in orders:
        if str(order.get("sku")) != str(sku):
            continue
        order_date = _as_date(order["order_date"])
        if start <= order_date <= today:
            quantities[order_date] += float(order.get("quantity", 0) or 0)
    return [quantities[start + timedelta(days=offset)] for offset in range(history_days)]


def _inbound_qty(inbounds: List[Dict[str, Any]], sku: str, today: date, through: date) -> int:
    total = 0
    for inbound in inbounds:
        if str(inbound.get("sku")) != str(sku):
            continue
        status = str(inbound.get("status", "")).lower()
        if status in {"received", "cancelled", "canceled"}:
            continue
        eta = _as_date(inbound["eta_date"])
        if today <= eta <= through:
            total += int(float(inbound.get("quantity", 0) or 0))
    return total


def _reorder(lots: List[Dict[str, Any]], orders: List[Dict[str, Any]], inbounds: List[Dict[str, Any]], today: date, lead_time_days: int = 30) -> List[Dict[str, Any]]:
    by_group: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for lot in lots:
        by_group[(str(lot.get("sku")), str(lot.get("warehouse")))].append(lot)
    recs = []
    for (sku, warehouse), group in sorted(by_group.items()):
        usable = 0
        expiring_90 = 0
        expiring_before_lead = 0
        for lot in _active_lots(group):
            exp = _as_date(lot["expiration_date"])
            qty = int(float(lot.get("quantity_on_hand", 0) or 0))
            if exp >= today:
                usable += qty
                if exp <= today + timedelta(days=90):
                    expiring_90 += qty
                if exp <= today + timedelta(days=lead_time_days):
                    expiring_before_lead += qty
        demand = _daily_demand(orders, sku, today)
        avg = statistics.mean(demand) if demand else 0.0
        std = statistics.pstdev(demand) if len(demand) > 1 else 0.0
        inbound_lead = _inbound_qty(inbounds, sku, today, today + timedelta(days=lead_time_days))
        inbound_target = _inbound_qty(inbounds, sku, today, today + timedelta(days=lead_time_days + 30))
        safety_stock = 1.65 * std * math.sqrt(max(lead_time_days, 1))
        reorder_point = avg * lead_time_days + safety_stock
        target_stock = avg * (lead_time_days + 30) + safety_stock
        net_position = usable + inbound_lead
        target_position = usable + inbound_target
        effective_position = max(0.0, net_position - expiring_before_lead)
        recommended_qty = int(math.ceil(max(0.0, target_stock - target_position)))
        days_of_supply = round(net_position / avg, 1) if avg > 0 else None
        if avg <= 0:
            status = "overstocked" if usable > 0 else "wait"
            recommended_qty = 0
            reason = "No recent demand is visible for this SKU, so avoid replenishment and review existing stock."
            reorder_by = today + timedelta(days=30)
        elif usable <= 0 or effective_position < avg * lead_time_days:
            status = "stockout risk"
            reason = f"Stockout risk due to {lead_time_days}-day lead time: effective inventory {effective_position:.0f} is below lead-time demand {avg * lead_time_days:.0f}."
            reorder_by = today
        elif net_position <= reorder_point:
            status = "reorder now"
            reason = f"Reorder now because inventory position {net_position:.0f} is at or below reorder point {reorder_point:.0f}."
            reorder_by = today
        elif expiring_90 > max(avg * 30, 1) and days_of_supply and days_of_supply > 90:
            status = "overstocked"
            recommended_qty = 0
            reason = f"Overstocked: {days_of_supply:.1f} days of supply and {expiring_90} units expire within 90 days."
            reorder_by = today + timedelta(days=30)
        else:
            status = "wait"
            reason = f"Wait because inventory position {net_position:.0f} covers the lead time plus safety stock."
            reorder_by = today + timedelta(days=30)
        recs.append(
            {
                "sku": sku,
                "warehouse": warehouse,
                "status": status,
                "recommended_order_qty": recommended_qty,
                "reorder_by_date": reorder_by.isoformat(),
                "reason": reason,
                "confidence": 0.75,
                "average_daily_demand": round(avg, 4),
                "lead_time_days": lead_time_days,
                "safety_stock": round(safety_stock, 2),
                "current_inventory": usable,
                "inbound_within_lead_time": inbound_lead,
                "inventory_expiring_within_90_days": expiring_90,
                "days_of_supply": days_of_supply,
                "reorder_point": round(reorder_point, 2),
            }
        )
    priority = {"stockout risk": 0, "reorder now": 1, "wait": 2, "overstocked": 3}
    return sorted(recs, key=lambda item: (priority.get(item["status"], 9), item["sku"], item["warehouse"]))


def _expiration_summary(lots: List[Dict[str, Any]], today: date) -> List[Dict[str, Any]]:
    buckets = {key: {"bucket": key, "quantity": 0, "value": 0.0} for key in ["expired", "0-30 days", "31-60 days", "61-90 days", "90+ days"]}
    for lot in _active_lots(lots):
        flags = _expiration_flags(lot["expiration_date"], today)
        qty = int(float(lot.get("quantity_on_hand", 0) or 0))
        buckets[str(flags["bucket"])]["quantity"] += qty
        buckets[str(flags["bucket"])]["value"] += qty * float(lot.get("unit_cost", 0) or 0)
    return [{**value, "value": round(float(value["value"]), 2)} for value in buckets.values()]


def _demand_trend(orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_sku = Counter()
    by_sku_month = defaultdict(int)
    for order in orders:
        sku = str(order.get("sku", ""))
        qty = int(float(order.get("quantity", 0) or 0))
        month = _to_date(order.get("order_date", ""))[:7]
        by_sku[sku] += qty
        by_sku_month[(sku, month)] += qty
    output = []
    for sku, _ in by_sku.most_common(5):
        points = [{"label": month, "value": qty} for (next_sku, month), qty in sorted(by_sku_month.items()) if next_sku == sku][-12:]
        output.append({"sku": sku, "points": points})
    return output


def _customer_reorder_cadence(customers: List[Dict[str, Any]], orders: List[Dict[str, Any]], today: date) -> Dict[str, Any]:
    customer_by_id = {str(customer["customer_id"]): customer for customer in customers}
    dates_by_customer = defaultdict(list)
    for order in orders:
        dates_by_customer[str(order["customer_id"])].append(_as_date(order["order_date"]))
    rows = []
    for customer_id, dates in dates_by_customer.items():
        dates = sorted(set(dates))
        last_order = dates[-1]
        diffs = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        avg_interval = statistics.mean(diffs) if diffs else 30.0
        days_since = (today - last_order).days
        if days_since >= max(21.0, avg_interval * 1.2):
            customer = customer_by_id.get(customer_id, {})
            rows.append(
                {
                    "customer_id": customer_id,
                    "name": customer.get("name", ""),
                    "region": customer.get("region", ""),
                    "channel": customer.get("channel", ""),
                    "last_order_date": last_order.isoformat(),
                    "days_since_last_order": days_since,
                    "avg_days_between_orders": round(avg_interval, 1),
                    "reason": "Customer is past its normal reorder cadence.",
                }
            )
    return {
        "template": "customer_reorder_cadence",
        "explanation": "These customers appear due for another order based on their historical buying cadence.",
        "columns": ["customer_id", "name", "region", "channel", "last_order_date", "days_since_last_order", "avg_days_between_orders", "reason"],
        "rows": sorted(rows, key=lambda row: row["days_since_last_order"], reverse=True)[:25],
    }


def _monthly_buyers(customers: List[Dict[str, Any]], orders: List[Dict[str, Any]], sku: str) -> Dict[str, Any]:
    customer_by_id = {str(customer["customer_id"]): customer for customer in customers}
    sku_orders = [order for order in orders if str(order.get("sku")) == sku]
    months = sorted(set(_to_date(order["order_date"])[:7] for order in sku_orders))
    total_months = max(1, len(months))
    by_customer = defaultdict(lambda: {"months": set(), "qty": 0, "last": ""})
    for order in sku_orders:
        entry = by_customer[str(order["customer_id"])]
        entry["months"].add(_to_date(order["order_date"])[:7])
        entry["qty"] += int(float(order.get("quantity", 0) or 0))
        entry["last"] = max(entry["last"], _to_date(order["order_date"]))
    rows = []
    for customer_id, entry in by_customer.items():
        coverage = len(entry["months"]) / total_months
        if coverage >= 0.45:
            customer = customer_by_id.get(customer_id, {})
            rows.append(
                {
                    "customer_id": customer_id,
                    "name": customer.get("name", ""),
                    "region": customer.get("region", ""),
                    "channel": customer.get("channel", ""),
                    "months_with_orders": len(entry["months"]),
                    "monthly_coverage": round(coverage, 2),
                    "avg_monthly_quantity": round(entry["qty"] / max(len(entry["months"]), 1), 1),
                    "last_order_date": entry["last"],
                }
            )
    return {
        "template": "monthly_sku_buyers",
        "explanation": f"Customers shown here buy {sku} with recurring monthly behavior in the loaded order history.",
        "columns": ["customer_id", "name", "region", "channel", "months_with_orders", "monthly_coverage", "avg_monthly_quantity", "last_order_date"],
        "rows": sorted(rows, key=lambda row: (row["monthly_coverage"], row["avg_monthly_quantity"]), reverse=True)[:25],
    }


def _materialize_views() -> Dict[str, int]:
    today = date.today()
    products = _read_records("products")
    lots = _read_records("inventory_lots")
    customers = _read_records("customers")
    orders = _read_records("orders")
    inbounds = _read_records("inbound_shipments")
    fefo = _fefo(lots, today)
    alerts = _waste_alerts(lots, today)
    recs = _reorder(lots, orders, inbounds, today)

    total_value = sum(int(float(lot.get("quantity_on_hand", 0) or 0)) * float(lot.get("unit_cost", 0) or 0) for lot in _active_lots(lots))
    risk_value = sum(
        int(float(lot.get("quantity_on_hand", 0) or 0)) * float(lot.get("unit_cost", 0) or 0)
        for lot in _active_lots(lots)
        if 0 <= _days_to_exp(lot["expiration_date"], today) <= 90
    )
    unit_cost_by_sku = defaultdict(float)
    count_by_sku = defaultdict(int)
    for lot in lots:
        unit_cost_by_sku[str(lot["sku"])] += float(lot.get("unit_cost", 0) or 0)
        count_by_sku[str(lot["sku"])] += 1
    for sku in list(unit_cost_by_sku):
        unit_cost_by_sku[sku] = unit_cost_by_sku[sku] / max(count_by_sku[sku], 1)

    dashboard = {
        "kpis": {
            "total_inventory_value": round(total_value, 2),
            "inventory_at_risk_value": round(risk_value, 2),
            "projected_stockouts": len([rec for rec in recs if rec["status"] == "stockout risk"]),
            "recommended_reorder_value": round(sum(rec["recommended_order_qty"] * unit_cost_by_sku[rec["sku"]] for rec in recs), 2),
            "waste_reduction_opportunity": round(risk_value * 0.35, 2),
        },
        "charts": {
            "demand_trend_by_sku": _demand_trend(orders),
            "inventory_by_expiration_bucket": _expiration_summary(lots, today),
            "reorder_urgency": [{"status": status, "count": count} for status, count in Counter(rec["status"] for rec in recs).items()],
        },
        "recommendations": recs[:20],
        "fefo": fefo[:20],
        "waste_risk_alerts": alerts[:20],
        "roi_explanation": "Waste reduction opportunity estimates 35% recoverable value from near-expiring inventory through FEFO allocation, transfer, promotion, or discount actions.",
    }
    _put_view("dashboard", dashboard)
    _put_view("fefo", {"rows": fefo})
    _put_view("waste_risk_alerts", {"rows": alerts})
    _put_view("reorder_recommendations", {"rows": recs})
    _put_view("query#expiring_inventory", {"template": "expiring_inventory", "explanation": "These lots expire within 90 days and should be prioritized before newer inventory.", "columns": ["sku", "lot_id", "warehouse", "quantity_at_risk", "expiration_date", "risk_bucket", "suggested_action"], "rows": alerts[:50]})
    _put_view("query#stockout_risk", {"template": "stockout_risk", "explanation": "These SKU and warehouse combinations need action based on demand, lead time, inbound supply, and current inventory.", "columns": ["sku", "warehouse", "status", "recommended_order_qty", "reorder_by_date", "days_of_supply", "reason", "confidence"], "rows": [rec for rec in recs if rec["status"] in {"stockout risk", "reorder now"}][:25]})
    _put_view("query#reorder_this_week", {"template": "reorder_this_week", "explanation": "These replenishment actions are due within the next 7 days based on stock position and lead-time demand.", "columns": ["sku", "warehouse", "status", "recommended_order_qty", "reorder_by_date", "reason", "confidence"], "rows": [rec for rec in recs if rec["recommended_order_qty"] > 0 and _as_date(rec["reorder_by_date"]) <= today + timedelta(days=7)][:25]})
    _put_view("query#customer_reorder_cadence", _customer_reorder_cadence(customers, orders, today))
    for sku in sorted(set(str(order["sku"]) for order in orders)):
        _put_view(f"query#monthly_buyers#{sku}", _monthly_buyers(customers, orders, sku))
    return {"products": len(products), "inventory_lots": len(lots), "customers": len(customers), "orders": len(orders), "inbound_shipments": len(inbounds)}


def _entity_from_key(key: str) -> str:
    parts = key.split("/")
    for part in parts:
        if part in REQUIRED_COLUMNS:
            return part
    raise ValueError("Could not infer import entity from S3 key.")


def _parse_content(key: str, content: bytes) -> List[Dict[str, str]]:
    lower = key.lower()
    if lower.endswith(".csv"):
        return _parse_csv(content)
    if lower.endswith(".xlsx") or lower.endswith(".xlsm"):
        return _parse_xlsx(content)
    raise ValueError("Unsupported file type. Use .csv, .xlsx, or .xlsm.")


def _process_file(bucket: str, key: str) -> Dict[str, Any]:
    entity = _entity_from_key(key)
    filename = key.rsplit("/", 1)[-1]
    _put_import_status(bucket, key, "processing", f"Validating and importing {entity}.", entity=entity, filename=filename)
    obj = s3.get_object(Bucket=bucket, Key=key)
    content = obj["Body"].read()
    rows = _parse_content(key, content)
    normalized, errors = _normalize(entity, rows)
    if errors:
        _put_import_status(bucket, key, "failed", "Import validation failed.", entity=entity, filename=filename, rows_seen=len(rows), errors=errors)
        return {"entity": entity, "status": "failed", "errors": errors}
    _write_records(entity, normalized)
    counts = _materialize_views()
    _put_import_status(
        bucket,
        key,
        "imported",
        f"Imported {len(normalized)} {entity} rows.",
        entity=entity,
        filename=filename,
        rows_seen=len(rows),
        rows_imported=len(normalized),
        view_counts=counts,
    )
    return {"entity": entity, "status": "imported", "rows_imported": len(normalized), "view_counts": counts}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    processed = []
    for record in event.get("Records", []):
        bucket = record.get("s3", {}).get("bucket", {}).get("name", "")
        key = unquote_plus(record.get("s3", {}).get("object", {}).get("key", ""))
        if not bucket or not key:
            continue
        try:
            processed.append({"bucket": bucket, "key": key, **_process_file(bucket, key)})
        except Exception as exc:
            _put_import_status(bucket, key, "failed", str(exc))
            processed.append({"bucket": bucket, "key": key, "status": "failed", "error": str(exc)})
    return {"statusCode": 200, "body": json.dumps({"processed": processed}, separators=(",", ":"))}
