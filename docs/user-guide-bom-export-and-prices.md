# User guide: bill of materials, export and prices

## Bill of materials

One list for the whole project: camera rows grouped by model + lens,
then sensor rows grouped by model, then fire-alarm rows grouped by kind (unit `pcs`), then cabling-point rows
(hubs, risers, drops, shaft openings; unit `pcs`; price `TBD`), then one
cable row per cable type in use, with quantity, labels, unit price, line total and one
estimated grand total. One placed beam counts as one transmitter + receiver set. A cable row's
quantity is whole metres to buy.
Every label always carries its floor prefix `F{n}_` - e.g. `F2_C1` is camera C1 on floor 2, `F2_C1_F2_H1` its cable, `F2_P1` alarm device P1 on
floor 2 (the first `F2_` is the floor). An "All floors" drop-down above the list can show one floor's rows
without the prefix. A one-floor project keeps the prefix. Cabling-point rows (hubs, risers, drops, shaft openings) carry price `TBD` and are excluded from the estimated total, named in a note as 'cabling points priced TBD'. Cable metres are summed
over all floors and rounded up once per type; a single floor's view rounds that floor alone, so
per-floor figures can add up to a few metres more than the project total (at most one metre
per extra floor and type). Per-cable lengths include the spare allowance (default 15%, editable under Allowances) and do not sum exactly to the whole-project metres (rounded once on the sum). Cables that could not be measured (a route through a shaft crossing
a scale-less floor, or a cycle in the path) are left out of the metres and the list says how many.
The PNG table has 11 columns: `Type, Brand, Model, Form Factor, Resolution, Lens,
Quantity, Unit, Labels, Unit Price (VND), Total (VND)`. The CSV export downloads two files: `<stem>-bom.csv` (the 11-column BOM above plus a 12th trailing column `Notes` for
fire-alarm compatibility warnings, filled only on fire-alarm rows when the device is "not listed" for a placed
panel/hub, or "No panel/hub placed"; cabling-point rows have `TBD` in the Total column), and when the project has a cable, `<stem>-cable_length_estimate.csv` (one row per cable: Cable, Type, Length (+N% spare) (m), Notes) from the "Per cable" list. A panel / hub placed on any floor counts as placed. For
sensors `Form Factor` is empty, `Resolution` / `Lens` filled for thermal only. For fire-alarm
devices `Type` is the device kind (e.g. "Smoke detector") and `Form Factor`, `Resolution` and
`Lens` are empty. For cabling points `Type` is the point kind (e.g. "Cable hub"), the rest empty. A cable row has Type `Cable`, the type name in `Model` and the price per
metre in `Unit Price`. Cable rows need a scale: a floor without one adds no metres and the
export says which floors.

## Export

PNG at image resolution with a legend + BOM strip (downscaled with a notice above
~16.7 M pixels), and BOM + cable-estimate CSVs. "Export PNG" exports the floor you are looking at and needs
its scale; the strip lists that floor's rows, matching the labels on the picture. The PNG
draws hubs, cables and routes and, when the plan has cables, a legend line with the cable
types and the provisional total. With several floors, "Export all floors" downloads one PNG
per floor, one after another (the browser may ask once to allow several downloads); floors
without a plan or a scale are skipped and named. Each strip then also says which floor it is,
names the shafts on it and notes that cable metres are rounded per floor, and the files are
named `F2-<floor name>-<image name>-device-layout.png`. The CSV export downloads `<stem>-bom.csv` (12 columns incl. Notes for fire-alarm compatibility) and, when the project has a cable, `<stem>-cable_length_estimate.csv` (one row per cable with length and notes). Project save/load as JSON.

## Prices

Prices are indicative Vietnam street prices in VND, read from a Vietnamese reseller's product
page on the date stored with each record; each catalog card links to its source. Models with
no published Vietnam price show "price on request" and are excluded from the estimated total
(the total says how many cameras, sensors or fire devices it leaves out). Axis camera prices
come from a cross-border marketplace, not an authorised distributor. Takex beam prices are set
prices (TX+RX pair). Fire-alarm devices: 35 of 62 have a Vietnamese price (nhaantoan.com or vuhoangtelecom.vn); 19 more link to a contact-for-price page on mastery.vn; no Shopee listing could be verified.
Sensor cards: the 14 priced records carry a secondary channel (the shop their price was read
from); none has a Shopee listing. Always confirm with your supplier.

Cable prices are the one price you type yourself: VND per metre, per cable type, saved with
the project. Nothing is prefilled. A type with no price shows "price on request" and is left
out of the total, which says how many cable types it leaves out.

A camera catalog record can also carry up to two sales channels - a primary one (a Shopee
shop) and a secondary one (another Vietnamese shop). Its card then shows one row per channel:
that shop's price and a "buy (shopee)" / "buy (hacom)" link. 63 Hikvision camera records
have them. The BOM keeps using one price per model: the secondary shop's where it shows one,
else the Shopee one.

## Catalog sources

Camera sources and method: [`docs/camera-catalog-sources.md`](./camera-catalog-sources.md).
Sensor sources: [`docs/sensor-catalog-sources.md`](./sensor-catalog-sources.md).
Fire-alarm sources: [`docs/fire-alarm-catalog-sources.md`](./fire-alarm-catalog-sources.md).

Back to the [README](../README.md).
