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

## Pilot Implication

The demo is realistic enough for a buyer walkthrough, but a paid pilot should import the buyer's own product master with their internal SKU, UPC/GTIN, case pack, shelf-life, and ERP/WMS cross-reference fields.
