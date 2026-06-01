from __future__ import annotations

from typing import Dict, List

import pandas as pd


def product_lookup(products: pd.DataFrame) -> Dict[str, Dict[str, object]]:
    if products.empty or "sku" not in products.columns:
        return {}
    fields = [field for field in ["sku", "name", "category", "case_size", "shelf_life_days"] if field in products.columns]
    return {str(row["sku"]): row for row in products[fields].to_dict("records")}


def enrich_product_rows(rows: List[Dict[str, object]], products: pd.DataFrame) -> List[Dict[str, object]]:
    lookup = product_lookup(products)
    enriched = []
    for row in rows:
        next_row = dict(row)
        product = lookup.get(str(next_row.get("sku", "")), {})
        if product:
            next_row.setdefault("product_name", product.get("name", ""))
            next_row.setdefault("category", product.get("category", ""))
            next_row.setdefault("case_size", product.get("case_size", ""))
        enriched.append(next_row)
    return enriched
