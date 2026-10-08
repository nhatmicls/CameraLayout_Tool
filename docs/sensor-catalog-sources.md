# Sensor Catalog Sources (Phase 1 provenance)

Every record in `data/<brand>/sensor-<kind>/*.json` is transcribed directly from an
official manufacturer datasheet (or, where the datasheet omits a field, the manufacturer's
own installation manual PDF - same domain). This doc is the audit trail: the exact URL
downloaded, the retrieval date, the datasheet page + exact quote for every stored field,
and a SHA-256 of the PDF bytes (the PDF itself is not committed - see "PDF handling" in
`docs/camera-catalog-sources.md`, same method here).

Method: `curl -A "Mozilla/5.0 ..." -L -o file.pdf "<url>"` -> verify `%PDF` header and page
count -> `pdftotext -raw` (cross-checked with `-layout` where a label/value pair looked
misaligned) -> values copied from the extracted text, never from memory, resellers, or
`research/researcher-01-sensor-datasheet-field-survey.md` (hints only, unverified - see
plan.md). Retrieval date for every row below: **2026-10-06**.

## C1-C9 decisions

- **C1 (PIR wall: range + angle?)** Confirmed as proposed. Every wall PIR datasheet
  surveyed prints a single range (m) + a single horizontal detection angle (deg) -
  modelled as `coverage: { rangeM, angleDeg, vfovDeg? }`.
- **C2 (PIR ceiling: single diameter at one height?)** Resolved otherwise, simpler than
  proposed. No ceiling-PIR datasheet found (Hikvision checked directly; Bosch DS936/
  DS937/DS9360/DS9370 snippets checked via search) prints a height-keyed diameter table.
  Every one prints a single range (radius) + a detection angle, same shape as a wall PIR,
  with angleDeg = 360 for the full-circle pattern. The proposed `shape: 'circle' with
  diameters[]` table form is **dropped from v1** (YAGNI/admission rule - never printed by
  a fetched PDF); `pirSchema.coverage` is one plain object, not a discriminated union.
  **Flag for whoever starts Phase 2**: plan.md's "PlacedSensor union on shape (sector |
  circle | beam)" assumed a `circle` catalog shape exists. It does not. Phase 2 can either
  treat a 360° sector as the "circle" render case, or add a derived PlacedSensor shape at
  render time when `angleDeg === 360` - no catalog schema change needed either way.
- **C3 (Beam: both indoor and outdoor max printed?)** Confirmed as proposed. Takex PB-TK
  series prints both distances per model (e.g. PB-30TK: outdoor 30 m / indoor 60 m).
- **C4 (Shock radius per surface material?)** Confirmed as proposed, single-row case: one
  material is named, one radius stored (`surface` is the printed material name, not
  generic `null`, since this datasheet does name it). No datasheet found printing more
  than one material/radius pair.
- **C5 (Glass-break: range + glass types printed?)** Confirmed as proposed. Hikvision
  DS-PDPG12P-EG2 prints both an 8 m range and six named glass types.
- **C6 (Thermal vehicle D/R/I printed?)** Confirmed as proposed - printed (non-null) for
  both lens SKUs on the one thermal datasheet obtained.
- **C7 (Bi-spectrum model?)** Yes - the one thermal datasheet obtained (DHI-TPC-BF2241) is
  a thermal+visible hybrid. Confirmed as proposed: thermal channel only is stored; the
  visible channel (lens mm, HFOV/VFOV, sensor) is named in `notes`, not modelled, and this
  model is not entered in `camera-catalog-schema.ts`'s catalog.
- **C8 (Metric units printed?)** All records this round print metres directly (Takex
  prints metres with feet alongside, e.g. "30m (100ft.)" - metres copied, feet ignored per
  rule). `convertedFromFeet` was not needed for any G1 record; the optional field exists on
  the common schema for the tail (step 12) in case a feet-only datasheet is used later.
- **C9 (Beam/shock sold and priced as a set?)** Resolved in the tail. All three Takex
  beam records (`takex-pb-30tk`/`-60tk`/`-100tk`) now carry a `priceVn`: each reseller
  page shows one price for the whole TX+RX set, not per-unit - noted per record. No set
  price was found for either shock sensor (`bosch-isc-sm-90`, `hikvision-ds-pdsk-p`) or
  the Hikvision PIR/glass-break combo - `priceVn` stays `null` there (see Records below
  for the specific search attempts). BOM counting (1 placed beam/shock sensor = 1 unit)
  remains a Phase 7 concern, not a catalog schema field.

## Zero-record kinds

None. All six survey targets (PIR wall, PIR ceiling, IR beam, shock, acoustic
glass-break, thermal) had an obtainable official PDF within the 45-minute/3-brand
time-box, so every kind branch (`pir`, `beam`, `vibration` in both `shock` and
`glass-break` forms, `thermal`) has at least one verified record. The fallback rule
(zero records, schema branch kept) was not needed this round.

## Field-form survey

| Target | Brand / model | URL | Field | Printed? | Exact quote | Page | Source doc |
|---|---|---|---|---|---|---|---|
| PIR wall | Hikvision DS-PDPG12P-EG2 | see Records below | Detection Range | yes | "Detection Range 12 m" | 2 | datasheet |
| PIR wall | Hikvision DS-PDPG12P-EG2 | " | Detection Angle | yes | "Detection Angle 85.9°" | 2 | datasheet |
| PIR wall | Hikvision DS-PDPG12P-EG2 | " | Mounting Height | yes | "Mounting Height 1.8 to 2.4 m" | 2 | datasheet (not modelled) |
| PIR wall | Dahua DHI-ARD2251E-W2(V) | see Records below | Detection Range / Angle | yes | "Angle:90°  Range:15 m (49.21 ft), the installation height is 1 m (3.28 ft)" | 1 | datasheet |
| PIR wall (alt., not shipped) | Hikvision DS-PDP18-EG2(B) | downloaded, not entered | Detection Range / Angle | yes | "Detection Range 18m" / "Detection Angle 85.9°" | 2 | datasheet |
| PIR ceiling | Hikvision DS-PDCL12-EG2-WE | see Records below | Detection Range | yes | "Detection Range 12m" | 2 | datasheet |
| PIR ceiling | Hikvision DS-PDCL12-EG2-WE | " | Detection Angle | yes | "Detection Angle 360°" | 2 | datasheet |
| PIR ceiling | Hikvision DS-PDCL12-EG2-WE | " | Mounting Height | yes | "Mounting Height 2.4 m to 4 m" | 2 | datasheet (band, not a per-diameter table; not modelled) |
| IR beam | Takex PB-30TK(K)/60TK(K)/100TK(K) | see Records below | Outdoor / Indoor max range | yes | "PB-30TK(K) Outdoor 30m (100ft.) Indoor 60m (200ft.)", "PB-60TK(K) Outdoor60m (200ft.) Indoor 120m (400ft.)", "PB-100TK(K) Outdoor100m (330ft.) Indoor 200m (660ft.)" | 1 | datasheet |
| IR beam | Takex PB-30TK | " | Response time | yes | "50msec to 700msec (Variable at pot)" | 2 | datasheet (not modelled) |
| Shock/vibration | Bosch ISC-SM-90 | see Records below | Operating radius | yes | "an effective radius of r = 5 m applies to steel and iron-reinforced concrete" | 1 | datasheet |
| Shock/vibration | Hikvision DS-PDSK-P | see Records below | Detection Range | yes | "Detection Range Up to 2.5m Radius" | 1 | datasheet |
| Acoustic glass-break | Hikvision DS-PDPG12P-EG2 | see Records below | Glass Break Range | yes | "Glass Break Range 8 m" | 2 | datasheet |
| Acoustic glass-break | Hikvision DS-PDPG12P-EG2 | " | Glass Type | yes | "Glass Type Float, Plate, Tampered, Wired, Laminated Leaded, Double Glazing" | 2 | datasheet |
| Acoustic glass-break | Hikvision DS-PDPG12P-EG2 | " | Glass Break Angle (cover bullet) | yes | "Glass Break Range: 8m / 120°" | 1 | datasheet (angle not modelled) |
| Thermal | Dahua DHI-TPC-BF2241 | see Records below | Field of View (per lens) | yes | "3.5 mm: H: 50.6°; V: 37.8°" / "7 mm: H: 24°; V: 18°" | 2 | datasheet |
| Thermal | Dahua DHI-TPC-BF2241 | " | Effective Distance (human, per lens) | yes | 3.5mm: "Detection ... Human: 146 m", "Recognition ... Human: 38 m", "Identification ... Human: 19 m" | 2 | datasheet |
| Thermal | Dahua DHI-TPC-BF2241 | " | Effective Distance (vehicle, per lens) | yes | 3.5mm: "Detection ... Vehicle: 389 m", "Recognition ... Vehicle: 97 m", "Identification ... Vehicle: 49 m" | 2 | datasheet |
| Thermal | Dahua DHI-TPC-BF2241 | " | Effective Pixels / Pixel Pitch / NETD | yes | "Effective Pixels 256 (H) × 192 (V)"; "Pixel Pitch 12 μm"; "Sensitivity (NETD) 40 mK@f/1.0" | 2 | datasheet |

## Records

### Hikvision (3 models, 4 records)

| Record id | Model | Kind | Field sources | Source doc | SHA-256 |
|---|---|---|---|---|---|
| hikvision-ds-pdpg12p-eg2-pir | DS-PDPG12P-EG2 | pir | p.2 "Detection Range 12 m"; p.2 "Detection Angle 85.9°" | datasheet | `a40f83d7953bbe75d1bd127f451e39dfabdff125a702cc20b788437d606e72d6` |
| hikvision-ds-pdpg12p-eg2-glass-break | DS-PDPG12P-EG2 | vibration (glass-break) | p.2 "Glass Break Range 8 m"; p.2 "Glass Type Float, Plate, Tampered, Wired, Laminated Leaded, Double Glazing" | datasheet | (same file as above) |
| hikvision-ds-pdcl12-eg2-we | DS-PDCL12-EG2-WE | pir | p.2 "Detection Range 12m"; p.2 "Detection Angle 360°" | datasheet | `d0df9e26f634526ab4853e883f50e7037d29492a6cd71c6250a4b5354bc7f5cc` |
| hikvision-ds-pdsk-p | DS-PDSK-P | vibration (shock) | p.1 "Detection Range Up to 2.5m Radius" | datasheet | `7dbf6168ad89554c97c6604fdc45c9de0d315e8884b1ddacf0076764cbc1fb0b` |

Source URLs:
- DS-PDPG12P-EG2: https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000933/S000000934/OFR001801/M000050023/Data_Sheet/DS-PDPG12P-EG2_Datasheet_V1.0_202201.pdf
- DS-PDCL12-EG2-WE: https://assets.hikvision.com/prd/public/all/doc/m000044573/DS-PDCL12-EG2-WE_Datasheet.pdf
- DS-PDSK-P: https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000937/S000000934/OFR000941/M000043915/Data_Sheet/DS-PDSK-P_Datasheet_V1.0_202209.pdf

All three PDFs verified: `%PDF` header present, 5 / 4 / 3 pages respectively (DS-PDPG12P-EG2
/ DS-PDCL12-EG2-WE / DS-PDSK-P), text extracted with `pdftotext -raw` (clean, label/value
pairs aligned 1:1; `-layout` was cross-checked and shifted several label/value rows by one
line on all three files, confirming `-raw` as the reliable mode for this label-left/
value-right PDF layout - same caution noted for Dahua WizSense sheets in
`docs/camera-catalog-sources.md`).

**Note on DS-PDPG12P-EG2**: this is a combo PIR + acoustic glass-break detector - one
datasheet, one `model` string, split into two catalog records (one `pir`, one
`vibration`) because the schema discriminates on `kind`. The glass type "Tampered" is
printed exactly that way (p.2); this is very likely the manufacturer's own typo for
"Tempered" but is copied as printed per the no-correction-from-memory rule.

**DS-PDSK-P (tail, Q3 answer)**: an ordinary wired wall-mount shock detector ("Reliable
perimeter protection offering early detection", p.1) - ordinary indoor door/window/safe
use, unlike `bosch-isc-sm-90`'s vault-only seismic detector. Found on the first official-
host search hit, no material/surface named (`surface: null`), satisfying the owner's Q3
ask without needing a Bosch replacement; `bosch-isc-sm-90` is kept per instruction.

**priceVn - DS-PDPG12P-EG2 (pir + glass-break)**: no VN reseller price found for this
exact wired model. Only the wireless `-WB` variant (a different radio SKU) is sold in
Vietnam (e.g. vuhoangtelecom.vn lists "DS-PDPG12P-EG2-WB" at ~1,305,000-1,792,000 VND
across sources) - not reused, since wired vs wireless is a materially different product
(unlike the camera catalog's `-LIUF`/`-LIU` lens-variant carryover). `priceVn: null`.

**priceVn - DS-PDCL12-EG2-WE**: no VN reseller price found for this exact `-WE` model.
Only a differently-suffixed `-WB (Gen2)` variant is priced (~720,000 VND) - not reused,
same reasoning as above. `priceVn: null`.

**priceVn - DS-PDSK-P**: 405,000 VND, vuhoangtelecom.vn, retrieved 2026-10-06
(https://vuhoangtelecom.vn/san-pham/cam-bien-rung-hikvision-ds-pdsk-p/ - exact model
match "DS-PDSK-P", page text "405.000 đ (Giá chưa bao gồm VAT)").

### Dahua (2 models, 3 records - 2 thermal + 1 pir)

| Record id | Model | Kind | Field sources | Source doc | SHA-256 |
|---|---|---|---|---|---|
| dahua-tpc-bf2241-b3f4-dw-s2 | DHI-TPC-BF2241-B3F4-DW-S2 | thermal | p.2 "Human: 146 m / 38 m / 19 m"; "Vehicle: 389 m / 97 m / 49 m" (Detection/Recognition/Identification); p.2 "3.5 mm: H: 50.6°; V: 37.8°" | datasheet | `006d74d19f3165a383caa0dcf5d5c16279d5ba97d1c954b1ef3bb0e0d26cf0c3` |
| dahua-tpc-bf2241-b7f8-dw-s2 | DHI-TPC-BF2241-B7F8-DW-S2 | thermal | p.2 "Human: 292 m / 75 m / 38 m"; "Vehicle: 778 m / 194 m / 97 m"; p.2 "7 mm: H: 24°; V: 18°" | datasheet | (same file as above) |
| dahua-ard2251e-w2-v-pir | DHI-ARD2251E-W2(V) | pir | p.1 "Angle:90°  Range:15 m (49.21 ft), the installation height is 1 m (3.28 ft)" | datasheet | `c1ccd8495939b5f0b6bd786e5f4aa1e1c0cfcd1ea54004f7da0355c70cc50bd6` |

Source URLs:
- DHI-TPC-BF2241: https://material.dahuasecurity.com/uploads/cpq/prm-os-srv-res/smart/datasheetzipfiles/TPC-BF2241_datasheet_20221020.pdf
- DHI-ARD2251E-W2(V): https://materialfile.dahuasecurity.com/uploads/cpq/prm-os-srv-res/smart/datasheetzipfiles/ARD2251E-W2(V)_datasheet_20241106.pdf

TPC-BF2241 verified: `%PDF` header present, 5 pages, `pdftotext -raw`. Ordering
Information table (p.4) gives the two full orderable SKUs used as `model`:
"DHI-TPC-BF2241-B3F4-DW-S2 Thermal: 3.5 mm; Visible: 4 mm" and "DHI-TPC-BF2241-B7F8-DW-S2
Thermal: 7 mm; Visible: 8 mm" - this table (not the shorter accessory-ordering line
earlier in the PDF) matches the Focal Length ("3.5 mm; 7 mm") and Field of View rows
exactly, so it was used for `model`. Effective Pixels "256 (H) × 192 (V)", Pixel Pitch
"12 μm", Sensitivity (NETD) "40 mK@f/1.0" (p.2) apply to both lens SKUs (shared sensor
body). Bi-spectrum: both SKUs are a thermal+visible hybrid bullet (visible lens 4mm/8mm
respectively, H:71.2°/33.4° V:52°/25° - printed p.2, not modelled, see C7). This model is
**not** entered in `camera-catalog-schema.ts`'s data.

ARD2251E-W2(V) verified (tail): `%PDF` header present, 3 pages, `pdftotext -raw`. Host
`materialfile.dahuasecurity.com` ends with `.dahuasecurity.com`. This is a wireless
outdoor PIR-camera (compatible only with the ARC3800H hub series, p.1). Its separate
built-in snapshot camera prints its own "Field of View 110° (H); 60° (V)" (p.1) - that is
the camera's optical FOV, not the PIR detection angle, and is not modelled.

**priceVn - both thermal records**: no Vietnamese reseller VND price found; the only
pricing found for this model was a USD listing on an international reseller
(cctv-mall.com), which is not a Vietnamese reseller page and was not used. `priceVn: null`.

**priceVn - dahua-ard2251e-w2-v-pir**: no Vietnamese reseller price found for this exact
model (only general Dahua outdoor-camera price-range summaries, not this SKU).
`priceVn: null`.

### Bosch (1 model, 1 record - vibration/shock)

| Record id | Model | Field sources | Source doc | SHA-256 |
|---|---|---|---|---|
| bosch-isc-sm-90 | ISC-SM-90 | p.1 "an effective radius of r = 5 m applies to steel and iron-reinforced concrete" | datasheet | `54e20e568ab298c1d43a3f2d7e3001698a47f62eecc0ed0f70ca8cbcab55597b` |

Source URL: https://cdn.commerce.boschsecurity.com/public/documents/ISC_SM_90__Data_sheet_enUS_9007200674545547.pdf

Verified: `%PDF` header present, 4 pages, `pdftotext -raw`. Host is
`cdn.commerce.boschsecurity.com`, which ends with `.boschsecurity.com` - accepted under
the same host-suffix rule as the camera catalog (`SENSOR_BRAND_OFFICIAL_HOSTS.bosch =
["boschsecurity.com"]`). This is a seismic/vault detector (monitors vault walls, safe
doors, ATMs, light-weight safes - p.1), not a wall/window shock sensor; kept per owner
instruction (tail Q3) alongside the ordinary wall-mount `hikvision-ds-pdsk-p` added this
round. No other material/radius row is printed for this model.

**Tail Q3 attempt - Bosch ISC-SK10**: searched 30 min for Bosch's own ordinary (non-vault)
shock sensor, ISC-SK10 (F.01U.306.235, "monitors doors, windows, safes, and ATM machines").
No copy of its datasheet was found hosted on `boschsecurity.com` or any subdomain -
every hit was a third-party distributor mirror (csd.com.au, surveillance-video.com,
fsm.fi, eanixter.com), none of which is an official Bosch host under the project rule.
Not entered. `hikvision-ds-pdsk-p` (official host, found on the first hit) satisfies the
"ordinary wall/window shock sensor" ask instead.

**priceVn**: no Vietnamese reseller price found (niche bank/vault security equipment, not
a consumer retail item). `priceVn: null`.

### Takex (3 models, 3 records - beam)

| Record id | Model | Field sources | SHA-256 |
|---|---|---|---|
| takex-pb-30tk | PB-30TK(K) | p.1 "PB-30TK(K) Outdoor 30m (100ft.) Indoor 60m (200ft.)" | `e767baa51cb977bba5e78ca03dc2d1ac0dfc7e48a262e2d38570831e1bc8f092` |
| takex-pb-60tk | PB-60TK(K) | p.1 "PB-60TK(K) Outdoor60m (200ft.) Indoor 120m (400ft.)" | (same file as above) |
| takex-pb-100tk | PB-100TK(K) | p.1 "PB-100TK(K) Outdoor100m (330ft.) Indoor 200m (660ft.)" | (same file as above) |

Source URL: https://takex.com/view-pdf?fileName=Cat_PB-TK.pdf (same PDF for all three SKUs)

Verified: `%PDF` header present, 3 pages, `pdftotext -raw` (title/branding text on this
PDF is garbled by a Japanese font encoding pdftotext cannot map - "Syntax Error: Unknown
character collection 'Adobe-Japan1'" - the SPECIFICATIONS table itself, including all
three Outdoor/Indoor distance rows, is plain Latin text and extracted cleanly;
cross-checked with `-layout`, same figures for all three models).

**priceVn (C9 - set pricing)**:
- `takex-pb-30tk`: 2,177,000 VND, thanhlinh.vn, retrieved 2026-10-06
  (https://thanhlinh.vn/takex-pb-30tk-k - page title "Photoelectric Twin Beam Sensor
  Outdoor/Indoor TAKEX PB-30TK(K)", exact model match including the "(K)" suffix).
- `takex-pb-60tk`: 2,700,000 VND, abaro.vn, retrieved 2026-10-06
  (https://abaro.vn/san-pham/bo-cam-bien-hong-ngoai-tia-kep-takex-pb-60tk/ - page labels
  it "Takex PB-60TK", without the datasheet's "(K)" suffix).
- `takex-pb-100tk`: 3,060,000 VND, abaro.vn, retrieved 2026-10-06
  (https://abaro.vn/san-pham/bo-cam-bien-hong-ngoai-tia-kep-takex-pb-100tk/ - page labels
  it "PB-100TK", same suffix note as PB-60TK).

All three reseller pages show one price for the complete TX+RX set (not per-unit),
consistent with "one beam = one set" (plan.md decision). The "(K)" suffix is a
color/variant code on the datasheet; the 60TK/100TK reseller pages drop it in their own
listing title while clearly selling the same core product line - flagged here per the
project's disclosure convention for this kind of minor cross-page naming gap (same
treatment as the camera catalog's `-LIUF`/`-LIU` price carryover note).

## `purchaseLinks` (sales channels, not a datasheet value)

Same shape and card rendering as the camera catalog (see `docs/camera-catalog-sources.md`):
one row per channel with that shop's price and a "buy (shop)" link.

- `secondary`: the Vietnamese shop page `priceVn` was read from - same URL, same displayed
  price, same date. Set for the four priced records: `hikvision-ds-pdsk-p` (vuhoangtelecom),
  `takex-pb-30tk` (thanhlinh), `takex-pb-60tk` and `takex-pb-100tk` (abaro).
- `primary` (the Shopee shop `daitailoc63`): `null` for every sensor record. Shopee serves a
  verification wall to anonymous requests, so its listings can only be read in a logged-in
  browser; none has been read for a sensor yet.
- The seven records with no `priceVn` have no channel at all (`purchaseLinks: null`).

## Hikvision AX HYBRID PRO / AX PRO tail (12 records, 2026-10-07)

Twelve more Hikvision motion/glass-break detectors, added only because each exact model is
sold by a Vietnamese shop (vuhoangtelecom.vn, or mastery.vn where vuhoangtelecom has no
listing - mastery shows "Lien he", i.e. contact for price, so `priceVn: null` there). Model
list sourced from Hikvision's "AX HYBRID PRO Device Compatibility List" (motion-detector
section) cross-checked one by one against vuhoangtelecom.vn / mastery.vn product search and
each model's own official `hikvision.com` datasheet. Retrieval date for every row below
(datasheet, shop page, mastery page): **2026-10-07**. Method as above:
`pdftotext -raw` extraction, values copied from the Specification table (never the cover-page
marketing bullets when the two disagree - see the DS-PDP15P-EG2-WB(B) note below).

| Record id | Model | Kind | Field sources | SHA-256 |
|---|---|---|---|---|
| hikvision-ds-pdp15p-eg2-wb-b | DS-PDP15P-EG2-WB(B) | pir | p.1 "Detection Range 15m"; p.1 "Detection Angle 90°" (spec table; cover bullet instead prints "15m / 85.9°" - not used, see note) | `84c9707c90e53a30c2b810e8d3c8850e19b2127bd185f375b2e18db3f7ccf345` |
| hikvision-ds-pdp18-hm-wb | DS-PDP18-HM-WB | pir | p.1 "Detection Range 18 m"; p.1 "Detection Angle 90°" | `6b5905d17c53ee3fa8de013d5353a9d570792385c2f06203fe3b90d6d0677af4` |
| hikvision-ds-pdc15-eg2-wb-b | DS-PDC15-EG2-WB(B) | pir | p.1 "Detection Range 15m"; p.1 "Detection Angle 6.3°" | `ace7d518ce6b1c4a7d77f7bc7f7de99cfbae923073c840ea193bb8f676ba8fee` |
| hikvision-ds-pdc10am-eg2-wb | DS-PDC10AM-EG2-WB | pir | p.1 "Wall mount: 10m / Ceiling mount: 5m" (wall value used, see note); p.1 "Detection Angle 5°" | `8b01452541a0c9157ceba2b73278ee516147f42a3f5044bdcd4f43d411e3374b` |
| hikvision-ds-pdd12p-eg2-wb | DS-PDD12P-EG2-WB | pir | p.1 "Detection Range 12m"; p.1 "Detection Angle 85.9°" | `efbb3f043b3574aaf3b7b7bfc898452aae36951b5c101d47c373d267d81acb75` |
| hikvision-ds-pdc10dm-eg2-wb | DS-PDC10DM-EG2-WB | pir | p.1 "Wall mount: 10m / Ceiling mount: 5m" (wall value used, see note); p.1 "Detection Angle 5°" | `9df2b120a0276fb2de5fcf29c74188af353c3c4d57ce2eadd8e2954cb5055400` |
| hikvision-ds-pdtt15am-lm-wb | DS-PDTT15AM-LM-WB | pir | p.1 "Detection Range 15 m"; p.1 "Detection Angle 90° @ 180° adjustable" (90° stored, see note) | `14c9f09bc0a23b73fa8cdbb15609497d8a1933070ae4708abca14851fbe2506a` |
| hikvision-ds-pdqp15am-lm-wb | DS-PDQP15AM-LM-WB | pir | p.1 "Detection Range 15 m"; p.1 "Detection Angle 180°" | `bd8ff56c93881ba174e2e68753a9813759d2bcea154be0db85e7dc1f6d56d08c` |
| hikvision-ds-pdpc12p-eg2-wb | DS-PDPC12P-EG2-WB | pir | p.1 "Detection range: 12m / 85.9°" (cover bullet, matches spec table "Detection Range 12m" / "Detection Angle 85.9°") | `e30e5ca82b8bfa426f6b10c7635ca2965454328cac467ca7de638f92fd453af4` |
| hikvision-ds-pdpc12p-eg2 | DS-PDPC12P-EG2 | pir | p.1 "Detection range: 12m / 85.9°" (cover bullet, matches spec table "Detection Range 12 m" / "Detection Angle 85.9°") | `5396f96e8c25d86d58bc625c686e5bbbcb4faf0c1f81ecd9aec06a3b35534faf` |
| hikvision-ds-pdbg8-eg2-wb | DS-PDBG8-EG2-WB | vibration (glass-break) | p.1 "Detection Range 8m"; p.1 "Glass Type Float,Plate,Tampered,Wired,Laminated Leaded,Double Glazing" | `4d1d5a17530d777b51f095200865dab6755ca8f4424adb08903293bfc28fda53` |
| hikvision-ds-pdpg12p-eg2-wb | DS-PDPG12P-EG2-WB | pir (combo, see note) | p.1 "PIR Detection Range: 12m / 85.9°" (cover bullet, matches spec table "Detection range 12m" / "Detection angle 85.9°") | `b45bb5f41d90cd75f3bfc810f847570aa7645d2b61f5b1980e937058cef1bd2e` |

Source URLs:
- DS-PDP15P-EG2-WB(B): https://assets.hikvision.com/prd/public/all/doc/m000109200/DS-PDP15P-EG2-WBB_Datasheet_20250421.pdf
- DS-PDP18-HM-WB: https://assets.hikvision.com/prd/normal/all/doc/m000061696/DS-PDP18-HM-WB_Datasheet_V1.0_202303.pdf
- DS-PDC15-EG2-WB(B): https://assets.hikvision.com/prd/normal/all/doc/m000109202/DS-PDC15-EG2-WBB_Datasheet_20250421.pdf
- DS-PDC10AM-EG2-WB: https://assets.hikvision.com/prd/public/all/doc/m000050009/DS-PDC10AM-EG2-WB_Datasheet.pdf
- DS-PDD12P-EG2-WB: https://assets.hikvision.com/prd/normal/all/doc/m000039126/DS-PDD12P-EG2-WB_Datasheet_20251111.pdf
- DS-PDC10DM-EG2-WB: https://assets.hikvision.com/prd/public/all/doc/m000050011/DS-PDC10DM-EG2-WB_Datasheet.pdf
- DS-PDTT15AM-LM-WB: https://assets.hikvision.com/prd/normal/all/doc/m000050025/DS-PDTT15AM-LM-WB_Datasheet.pdf
- DS-PDQP15AM-LM-WB: https://assets.hikvision.com/prd/normal/all/doc/m000062910/DS-PDQP15AM-LM-WB_Datasheet.pdf
- DS-PDPC12P-EG2-WB: https://assets.hikvision.com/prd/normal/all/doc/m000039121/DS-PDPC12P-EG2-WB_Datasheet_20251111.pdf
- DS-PDPC12P-EG2: https://assets.hikvision.com/prd/normal/all/doc/m000057878/DS-PDPC12P-EG2_Datasheet_V1.0_202207.pdf
- DS-PDBG8-EG2-WB: https://assets.hikvision.com/prd/normal/all/doc/m000039137/DS-PDBG8-EG2-WB_Datasheet_20251111.pdf
- DS-PDPG12P-EG2-WB: https://assets.hikvision.com/prd/normal/all/doc/m000039118/DS-PDPG12P-EG2-WB_Datasheet_20260605.pdf

All twelve PDFs retrieved and SHA-256-verified before extraction (session scratchpad, not
committed - see "PDF handling" below); `pdftotext -raw` text extracted cleanly for every
file (label-left/value-right Specification table, same layout as the rest of this catalog).

**Detection-angle / range discrepancy notes:**
- **DS-PDP15P-EG2-WB(B)**: the cover-page marketing bullet prints "Detection Range: 15m /
  85.9°" but the Specification table prints "Detection Range 15m" / "Detection Angle 90°".
  The 85.9° bullet figure matches the unrelated DS-PDPC12P-EG2(-WB) models exactly and is
  judged a copy-paste leftover in the marketing bullet; the Specification table (90°) is
  used, consistent with how every other record in this catalog is sourced (spec table, not
  cover bullets).
- **DS-PDC10AM-EG2-WB / DS-PDC10DM-EG2-WB**: both print two Detection Range rows ("Wall
  mount: 10m" / "Ceiling mount: 5m") for one dual-mount (wall or ceiling) product. The
  wall-mount figure (10m, listed first) is stored as `coverage.rangeM`; the ceiling-mount
  alternate (5m) is named in `notes`, not modelled (schema has one `rangeM` field, same
  single-value constraint noted at C1/C2).
- **DS-PDTT15AM-LM-WB**: prints "Detection Angle 90° @ 180° adjustable". The 90° detection
  angle is stored; 180° is the span the detector can be adjusted over, not an angle covered at
  once, so storing it would overstate the area covered.
- DS-PDPC12P-EG2-WB and DS-PDPC12P-EG2 are PIR-camera / PIRCAM detectors: the built-in
  camera's own "Field Angle" (88°(H)/68°(V) and 109°(H)/60°(V) respectively) is that
  camera's optical FOV, not the PIR detection angle - not modelled, same treatment as
  `dahua-ard2251e-w2-v-pir`.
- DS-PDBG8-EG2-WB is a pure acoustic glass-break detector (no PIR) - modelled as a single
  `vibration`/`glass-break` record, same shape as `hikvision-ds-pdpg12p-eg2-glass-break`.
  Its "Detection Angle 120°" is printed but not modelled (vibration schema carries no angle
  field).
- DS-PDPG12P-EG2-WB is a combo PIR + acoustic glass-break detector, same physical class as
  the already-catalogued wired DS-PDPG12P-EG2. Per explicit instruction for this tail, it is
  stored as **one `pir` record only** (PIR range/angle), with the glass-break figures named
  in `notes` and NOT split into a second catalog record - unlike the wired sibling pair
  (`hikvision-ds-pdpg12p-eg2-pir` / `hikvision-ds-pdpg12p-eg2-glass-break`), which remains
  split as before.

**priceVn / purchaseLinks (shop data, not datasheet values):**
- `hikvision-ds-pdd12p-eg2-wb`: 1,880,000 VND, vuhoangtelecom.vn, retrieved 2026-10-07
  (https://vuhoangtelecom.vn/san-pham/cam-bien-hong-ngoai-khong-day-hikvision-ds-pdd12p-eg2-wb/).
- `hikvision-ds-pdpc12p-eg2-wb`: 2,470,000 VND, vuhoangtelecom.vn, retrieved 2026-10-07
  (https://vuhoangtelecom.vn/san-pham/hong-ngoai-khong-day-kem-camera-hikvision-ds-pdpc12p-eg2-wb/).
- `hikvision-ds-pdbg8-eg2-wb`: 945,000 VND, vuhoangtelecom.vn, retrieved 2026-10-07
  (https://vuhoangtelecom.vn/san-pham/dau-bao-kinh-vo-khong-day-433-mhz-hikvision-ds-pdbg8-eg2-wb/) -
  a mastery.vn listing also exists for this model (contact-only) but vuhoangtelecom's numeric
  price takes precedence per the stated rule.
- `hikvision-ds-pdpg12p-eg2-wb`: 1,580,000 VND, vuhoangtelecom.vn, retrieved 2026-10-07
  (https://vuhoangtelecom.vn/san-pham/hong-ngoai-bao-vo-kinh-khong-day-hikvision-ds-pdpg12p-eg2-wb/) -
  same precedence note as above (mastery.vn also lists it, contact-only).
- The other seven records (`hikvision-ds-pdp15p-eg2-wb-b`, `hikvision-ds-pdp18-hm-wb`,
  `hikvision-ds-pdc15-eg2-wb-b`, `hikvision-ds-pdc10am-eg2-wb`, `hikvision-ds-pdc10dm-eg2-wb`,
  `hikvision-ds-pdtt15am-lm-wb`, `hikvision-ds-pdqp15am-lm-wb`, `hikvision-ds-pdpc12p-eg2`):
  no vuhoangtelecom.vn listing found; mastery.vn lists each but shows "Lien he" (contact for
  price, no number) - `priceVn: null`, `purchaseLinks.secondary` set to that mastery.vn page
  with `amountVnd: null`. `purchaseLinks.primary` is `null` for all twelve (no Shopee listing
  verified for any of them, same as the rest of the sensor catalog).

**Record id cross-reference update**: 23 records total now (11 pre-existing + 12 this
round), every id below appears in exactly one `data/hikvision/sensor-<kind>/*.json` file and
in a Records table in this doc: hikvision-ds-pdp15p-eg2-wb-b, hikvision-ds-pdp18-hm-wb,
hikvision-ds-pdc15-eg2-wb-b, hikvision-ds-pdc10am-eg2-wb, hikvision-ds-pdd12p-eg2-wb,
hikvision-ds-pdc10dm-eg2-wb, hikvision-ds-pdtt15am-lm-wb, hikvision-ds-pdqp15am-lm-wb,
hikvision-ds-pdpc12p-eg2-wb, hikvision-ds-pdpc12p-eg2, hikvision-ds-pdbg8-eg2-wb,
hikvision-ds-pdpg12p-eg2-wb (added this round), plus the original 11 listed under "Record id
cross-reference (JSON <-> this doc)" below.

## Downloaded but not entered (available for a future tail)

| Candidate | Brand | Reason not entered |
|---|---|---|
| DS-PDP18-EG2(B) (18m/85.9° wall PIR) | Hikvision | Datasheet verified (`fa6057a38d0269b98501a60ae45a853c8c406a36f4274355ff462d88c3b13b09`, 3 pages); not needed once DS-PDPG12P-EG2 + DHI-ARD2251E-W2(V) covered the PIR-wall kind across two brands. Good next PIR-wall record if more are wanted. |
| DS-PD2-P15E (15m/85° wall PIR) | Hikvision | Datasheet verified (`1f6050e72213a883c0d7a3a08bc520361b8bc752ae8c49ac33d0f0947590886f`, 3 pages); same reason as above. |
| DH-TPC-BF5421-T (thermal body-temperature screening camera) | Dahua | Read in full this round (`99e379b44445b29e3a2b756c1bc7b3bef27e4e48cf620f9f3f8acd5debaaa992`, 3 pages): this is a fever-screening camera (temperature accuracy ±0.3°C, range 28-45°C) - its datasheet prints HFOV/VFOV per lens (10mm/13mm) but **no human/vehicle Detection/Recognition/Identification distances anywhere**, so it cannot satisfy `thermalSchema.detectionRangeM` (a required field). Excluded - not a schema-admissible record, not merely "not needed". |
| PXB-HF beam series | Takex | Downloaded (`5356122a1b81021c5c47bc3dc54ee14a536865bbb3250792886358ed9bb9a880`, 7 pages) but not read in detail - PB-TK series already met the beam target (3 records). |
| DS6MX (six-zone control panel) | Bosch | Downloaded (`20d918284ced01729c5eaaebd902e58fa4e0cbaa1d0e35e400921890a52e887a`, 4 pages) while searching for a shock sensor; it is a control panel, not a detector - excluded, not a sensor-catalog candidate at all. |
| ISC-SK10 (ordinary shock sensor) | Bosch | Searched (tail Q3, 30 min time-box); only third-party distributor-hosted PDF copies found (csd.com.au, surveillance-video.com, fsm.fi, eanixter.com), none on an official `boschsecurity.com` host. Not entered - see "Tail Q3 attempt" note under Bosch above. |

## Record id cross-reference (JSON <-> this doc)

11 records, every id below appears in exactly one `data/<brand>/sensor-<kind>/*.json`
file and in the "Records" tables above (checked both directions - no id in the JSON that
is undocumented here, no id documented here that is missing from the JSON):

hikvision-ds-pdpg12p-eg2-pir, hikvision-ds-pdpg12p-eg2-glass-break,
hikvision-ds-pdcl12-eg2-we, hikvision-ds-pdsk-p, dahua-tpc-bf2241-b3f4-dw-s2,
dahua-tpc-bf2241-b7f8-dw-s2, dahua-ard2251e-w2-v-pir, bosch-isc-sm-90, takex-pb-30tk,
takex-pb-60tk, takex-pb-100tk.

## PDF handling

Same as the camera catalog: PDFs are downloaded to a local scratch directory for this
session only and never committed. The SHA-256 above lets anyone re-download the same
`sourceUrl` and confirm byte-identical content.

## Hikvision wired detectors sold in Vietnam (second pass)

Added 2026-10-07 on the owner's request for more wired devices. Each model has a saved
mastery.vn product page for the exact model ("Liên hệ", contact for price) and an official
datasheet whose text contains the exact model string.

| Record id | Model | Kind | Printed values used | Datasheet | SHA-256 | Shop |
|---|---|---|---|---|---|---|
| `hikvision-ds-pdc10am-vg3` | DS-PDC10AM-VG3 | pir | p.1 Detection Range "Wall Mount：10m" (stored) / "Ceiling Mount：6m"; Detection Angle "5°" | https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000937/S000000934/OFR001804/M000050014/Data_Sheet/DS-PDC10AM-VG3_Datasheet_V1.0_202106.pdf | `abd37ee2aa0ceb5eb966ac278f42dfd8a40256b68a3bbcce5cc6bea36ddbda62` | contact for price (mastery) https://mastery.vn/sanpham/cam-bien-hong-ngoai-co-day-hikvision-ds-pdc10am-vg3/ |
| `hikvision-ds-pdc10dm-vg3` | DS-PDC10DM-VG3 | pir | p.1 Detection Range "Wall Mount：10m" (stored) / "Ceiling Mount：6m"; Detection Angle "5°" | https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000933/S000000934/OFR001803/M000050015/Data_Sheet/DS-PDC10DM-VG3_Datasheet_V1.0_202106.pdf | `09fc9371d79e0c91055cd6e3fd826c369263e15ce3da8aa9d5ba1cdbb51c87b6` | contact for price (mastery) https://mastery.vn/sanpham/cam-bien-hong-ngoai-co-day-hikvision-ds-pdc10dm-vg3/ |
| `hikvision-ds-pdd15am-eg2` | DS-PDD15AM-EG2 | pir | p.1 "Detection Range 15 m"; "Detection Angle 85.9°" | https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000937/S000000934/OFR000956/M000050017/Data_Sheet/DS-PDD15AM-EG2_Datasheet_V1.0_202205.pdf | `d2fcf4003ac278ed5715fca6db215c01661c552c2535d3b44d787ca8f22b968b` | contact for price (mastery) https://mastery.vn/sanpham/cam-bien-chuyen-dong-hikvision-ds-pdd15am-eg2/ |

These wired detectors are on neither of Hikvision's compatibility lists, so no control panel
lists them; with a panel chosen in the "Works with" filter they are hidden.

## Hikvision wired detectors from the nhaantoan price list (third pass, 2026-10-08)

Owner request (2026-10-08): add the wired detectors of the owner's nhaantoan.com price list.
Prices are copied from the owner's screenshots of that list (nhaantoan.com cannot be read by
script - see `fire-alarm-catalog-sources.md`, section of the same name); `priceVn` and
`purchaseLinks.secondary` carry that price and a nhaantoan link.

| Record id | Model | Kind | Printed values used | Source | SHA-256 | Price (nhaantoan) |
|---|---|---|---|---|---|---|
| `hikvision-ds-pdp18-eg2` | DS-PDP18-EG2 (sold as SH-PDP618-EG2) | pir | "Detection range 18m, 85.9°" | Hikvision user manual https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000933/S000000934/OFR000955/M000011344/Quick_Start_Guide/102021815-UD13284B-B_Baseline_DS-PDP18-EG2_18m-Digital-PIR-Detector_User-Manual_V1.0_20200320.pdf | `fe4feef2460232d2e3fc547920180d2d65ff7e38de8bfa3ee3664d990edae86e` | 410.000đ |
| `hikvision-ds-pdd12p-eg2` | DS-PDD12P-EG2 | pir | "Detection Range 12m"; "Detection Angle 85.9°" | datasheet https://assets.hikvision.com/prd/public/all/doc/m000040442/DS-PDD12P-EG2_Datasheet_20250421.pdf | `b3134a6da37fe099b77acfca4b0ba9c099b2ab97b05c76a687e17b848070011d` | 1.110.000đ |
| `hikvision-ds-pdcl12-eg2` | DS-PDCL12-EG2 | pir | "Detection range 12m"; "Detection angle 360°" | official product page, specification table https://www.hikvision.com/en/products/Alarm-Products/wired-intrusion-alarm/i-o-devices/ds-pdcl12-eg2/ | - | 890.000đ |
| `hikvision-ds-pdtt15am-lm` | DS-PDTT15AM-LM | pir | "Detection Range 15m"; "Detection Angle 90° @ 180° adjustable" (90° stored) | datasheet https://assets.hikvision.com/prd/normal/all/doc/m000050027/DS-PDTT15AM-LM_Datasheet_20250421.pdf | `81a45412b21a206e5d2d22e869068fa7bbfba4f596b7298b6c533b89d4029312` | 5.350.000đ |
| `hikvision-ds-pdbg8-eg2` | DS-PDBG8-EG2 | vibration (glass-break) | "Detection Range 8m"; "Glass Type Float, Plate, Tampered, Wired, Laminated Leaded, Double Glazing" | datasheet https://assets.hikvision.com/prd/public/all/doc/m000044201/DS-PDBG8-EG2_Datasheet_20250421.pdf | `89db5aef03a6e4a5e61f5177ad759c4dbd9f19318664421e48e932222c181e6a` | 750.000đ |

- **DS-PDCL12-EG2 is the one record not sourced from a PDF.** Hikvision publishes no datasheet
  or manual for the wired model (only for the wireless -WE / -WB ones); its range and angle are
  copied as printed from the specification table of the official hikvision.com product page.
  Accepted on the owner's "add all" instruction of 2026-10-08.
- DS-PDP18-EG2 is sourced from the plain model's user manual; the DS-PDP18-EG2(B) datasheet is a
  different model and is not used.
- Existing records repriced from the same list: DS-PDD15AM-EG2 1.480.000đ (was a mastery.vn
  contact-for-price link) and DS-PDSK-P 720.000đ (replaces vuhoangtelecom.vn 405.000đ of
  2026-10-06; owner instruction: prices from nhaantoan).
- All seven wired detectors of this list in the catalog (the five above, DS-PDD15AM-EG2 and
  DS-PDSK-P) are named in the three AX Hybrid PRO panels' compatibility entries by owner
  decision - see `fire-alarm-catalog-sources.md`. This supersedes "with a panel chosen in the
  Works with filter they are hidden" above for DS-PDD15AM-EG2.
- DS-PD1-BG9 (glass-break) and DS-PD2-T12AME-EL (outdoor tri-tech) have no official source for
  the exact model, so no range can be stored and they are NOT sensor-catalog records. By owner
  decision they are marker-only `intrusion-detector` records of the fire-alarm catalog, shown
  in the Sensors tab with "no datasheet" - see `fire-alarm-catalog-sources.md`.

Record count after this pass: 31 (21 pir, 3 beam, 5 vibration, 2 thermal).
