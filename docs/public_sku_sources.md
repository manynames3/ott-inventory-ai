# Public SKU Source Notes

StockSense AI's bundled Ottogi-style dataset uses public product identifiers where they could be verified from public distributor or retail listings. These are not claimed to be Ottogi's private ERP item master records.

## Identifier Policy

- Use public distributor item codes when visible, for example `08252K`.
- Use UPC-backed identifiers when a distributor item code was not found, for example `UPC-645175525196`.
- Use `OTK-DEMO-*` only for demo-specific rows where no public identifier was verified.
- Replace all demo identifiers with the buyer's ERP item master during a real pilot.

## Public Sources Used

- [Rhee Bros indexed 2021 catalog](https://www.rheebros.com/2021%20catalog.pdf) snippets for distributor item codes and UPCs, including Jin Ramen, Yeul Ramen, Jjajang Noodles, Champong Noodles, Odongtong Noodles, curry pouch, curry powder, and jjajang powder references.
- [UPCItemDB UPC 645175520122](https://www.upcitemdb.com/upc/645175520122) for Jin Ramen Hot/Spicy and [UPCItemDB UPC 645175570103](https://www.upcitemdb.com/upc/645175570103) for Jin Ramen Cup Mild.
- Retailer pages such as [QFC/Kroger UPC 0064517529030](https://www.qfc.com/p/ottogi-instant-curry-sauce-mild/0064517529030) and Asian grocery listings when they expose UPC fields.
- Public barcode/product indexes such as [Buycott Ottogi UPC listings](https://www.buycott.com/brand/45829/ottogi-upc), [Buycott Ottogi Co. UPC listings](https://www.buycott.com/brand/46189/ottogi-co-upc), Target, Saltie, NutritionDataList, MarketOh, Seven, Aasia Market, and H Mart catalog snippets for additional UPC/EAN-backed examples.

## Verified Anchor Examples

| Demo SKU | Product | Public basis |
| --- | --- | --- |
| `08252K` | Ottogi Jin Ramen Hot Case | Rhee Bros catalog snippet with UPC `645175520122`; UPCItemDB also lists `645175520122` for Jin Ramen Hot/Spicy. |
| `08253K` | Ottogi Jin Ramen Mild Case | Rhee Bros catalog snippet with UPC `645175520115`. |
| `08256K` | Ottogi Yeul Ramen Hot Pepper | Rhee Bros catalog snippet with UPC `645175521075`. |
| `08257K` | Ottogi Jjajang Noodles Black Bean 5-Pack | Rhee Bros catalog snippet with UPC `645175521440`. |
| `08258K` | Ottogi Champong Noodles Spicy Seafood 5-Pack | Rhee Bros catalog snippet with UPC `645175521556`. |
| `08262K` | Ottogi Odongtong Myon Seafood Noodle | Rhee Bros catalog snippet with UPC `645175522942`. |
| `08324K` | Ottogi Jin Ramen Cup Hot Case | Rhee Bros catalog snippet with UPC `645175570288`. |
| `08325K` | Ottogi Jin Ramen Cup Mild Case | Rhee Bros catalog snippet with UPC `645175570103`; UPCItemDB also lists `645175570103`. |
| `03632K` | Ottogi 3 Minute Curry Mild Pouch | Rhee Bros catalog snippet and QFC/Kroger UPC page with UPC `0064517529030`. |
| `03477K` | Ottogi 3 Minute Jjajang Sauce Pouch | Rhee Bros catalog snippet with UPC `645175291305`. |
| `UPC-645175293309` | Ottogi Hash Rice Sauce Pouch | Buycott listing for Ottogi 3 Minute hashed sauce. |
| `EAN-8801045890418` | Ottogi Cooked Rice White Bowl | Buycott listing for Ottogi cooked rice. |
| `UPC-645175930082` | Ottogi Cooked Rice Brown Bowl | Target listing for OTOKI instant cooked brown rice with UPC `645175930082`. |
| `EAN-8801045140216` | Ottogi Mayonnaise | Buycott listing for Ottogi mayonnaise. |
| `EAN-8801045141213` | Ottogi Gold Mayonnaise | Buycott listing for Ottogi gold mayonnaise. |
| `EAN-8801045122137` | Ottogi Tonkatsu Sauce | Buycott listing for Ottogi sesame pork cutlet sauce. |
| `EAN-8801045129426` | Ottogi Korean BBQ Bulgogi Sauce | Buycott listing for Ottogi bulgogi sauce and marinade. |
| `UPC-645175440406` | Ottogi Sesame Oil | NutritionDataList listing for Ottogi sesame oil. |
| `EAN-8801045203218` | Ottogi Brown Rice Vinegar | Buycott listing for Ottogi brown rice vinegar. |
| `EAN-8801045200521` | Ottogi Brewed Vinegar | Buycott listing for Ottogi vinegar. |
| `EAN-8801045420400` | Ottogi Frying Mix | MarketOh listing for Ottogi frying mix with UPC `8801045420400`. |
| `EAN-8801045420509` | Ottogi Tempura Mix | AsiaFoods listing for Ottogi tempura mix with code `8801045420509`. |
| `EAN-8801045053103` | Ottogi Corn Soup Powder | Saltie listing for Ottogi corn cream soup powder. |
| `UPC-645175620105` | Ottogi Seaweed Soup | NutritionDataList listing for Ottogi seaweed soup. |
| `UPC-645175200154` | Ottogi Honey Citron Tea | Buycott listing for Ottogi honey citron tea. |
| `EAN-8801045643212` | Ottogi Hot Pepper Tuna | Saltie listing for Ottogi red pepper tuna. |
| `EAN-8801045350288` | Ottogi Roasted Seaweed Snack | Buycott listing for Ottogi cut dried seaweed. |

## Pilot Implication

The current demo has 37 public distributor or UPC/EAN-backed product identifiers and 73 fictional `OTK-DEMO-*` stand-ins. It is realistic enough for a buyer walkthrough, but a paid pilot should import the buyer's own product master with their internal SKU, UPC/GTIN, case pack, shelf-life, and ERP/WMS cross-reference fields.
