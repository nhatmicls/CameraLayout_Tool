# Fire-alarm catalog sources

Audit trail for every record in `data/hikvision/fire-alarm-<kind>/*.json`, for the compatibility
entries stored on controller records, and for the TCVN 5738:2021 table used by the "TCVN 5738"
coverage mode. Every stored value is copied as printed from an official Hikvision PDF that was
downloaded and read; nothing comes from memory, a reseller, a search snippet or a calculation.

Method: `curl -A "Mozilla/5.0 ..." -L -o file.pdf "<url>"` -> check the `%PDF` header ->
`pdftotext -raw` -> copy values from the extracted text -> `sha256sum`. Retrieval date for every
row below: **2026-10-07**. Accepted hosts: `hikvision.com` (any subdomain) and `hikvision.vn`.

## Decisions C1-C9

- **C1 / C2 (protection radius or area printed?)** No. None of the four detector datasheets
  (DS-PDSMK-S-WE, DS-PDHT-E-WE, DS-PDCO-E-WE, HF-S2) prints a protection radius or area. The
  catalog therefore has no protection field, and the "Datasheet" coverage mode draws markers
  only. A detector circle exists only in "TCVN 5738" mode.
- **C3 (compatibility granularity)** Model-level. Hikvision publishes two model-by-model
  compatibility lists (AXPRO Series, AX HYBRID PRO); every stored pair is a row of one of
  them. See "Compatibility pairs".
- **C4 (firmware / version condition per row)** Printed on both lists; copied into each
  entry's `note`.
- **C5 (standalone operation stated?)** Only HF-S2 (see its record). All AX devices:
  `worksStandalone: false`. The heat and CO datasheets print "10 years for standalone sensor"
  under battery life; that is a battery figure, not a statement that the device works without
  a hub, so it is not read as standalone operation.
- **C6 (certifications)** Printed on two records only: DS-PDSMK-S-WE "EN 14604 Certified",
  HF-S2 "Executive standard EN14604:2005". Every other record: none printed -> `[]`.
- **C7 (capacity)** Printed on panels and hubs ("Device management" / "Software features"
  rows). Stored as label / value pairs exactly as printed; display only.
- **C8 (combined smoke + heat detector)** None found; none shipped.
- **C9 (TCVN table shape)** As expected: rows of (height band, area, spacing, wall distance),
  one table per detector type.

## Records (12)

| Record id | Model as printed | Kind | Product line | Datasheet title as printed | SHA-256 of the PDF |
|---|---|---|---|---|---|
| `hikvision-ds-pha48-ep` | DS-PHA48-EP | control-panel | ax-hybrid | "AX Hybrid Pro Control Panel" | `dc1d892ab0595312cae96f5d9f187849bd64c47dec2ac2b8e05ee4280fc16646` |
| `hikvision-ds-pha64-lp-b` | DS-PHA64-LP(B) | control-panel | ax-hybrid | "AX HYBRID PRO" | `bbb980c958d37395a06bdf97fd2244263205550e1c36f1b377d741b086e09459` |
| `hikvision-ds-pm1-i8o2-h` | DS-PM1-I8O2-H | expander-module | ax-hybrid | "Speed-X Wired Input Expander" | `6d1c82a6a10763a02fc95d27c16cf01c0ab640c4333e5b19a3b1fd1a27cd71de` |
| `hikvision-ds-pk1-lrt-hwe` | DS-PK1-LRT-HWE | keypad | ax-hybrid | "Wired keypad" | `00f8514aa022affb95d8d59c730f5b88bef546b0b5c51685bb8898b59cb2bc5c` |
| `hikvision-ds-pwa96-m-we` | DS-PWA96-M-WE | wireless-hub | ax-pro | "AX PRO (868MHz)" | `f3a1f12ea205c5ec40cf2cc341b09f0ffd1cc3ac90b86ec3d09ab030136580d4` |
| `hikvision-ds-pwa96-m2h-wb` | DS-PWA96-M2H-WB | wireless-hub | ax-pro | "AX PRO with wired zones" | `0d8dfee08c430c3b914ca47e425f1af37b0b3e16b58586e28d90faaaacc12a7b` |
| `hikvision-ds-pdsmk-s-we` | DS-PDSMK-S-WE | smoke-detector | ax-pro | "Wireless Photoelectric Smoke Detector" | `97a6cb13017f4ff73520bbc5f11c4f5cc6eda2908a8cdd19ad566ff2f90c5d82` |
| `hikvision-ds-pdht-e-we` | DS-PDHT-E-WE | heat-detector | ax-pro | (model only; "Alarm when ambient temperature exceeds 57") | `7fbf585e1f15e63e72503c4e1831194fef22f4835cf6110a2da1b364d07e9527` |
| `hikvision-ds-pdco-e-we` | DS-PDCO-E-WE | co-detector | ax-pro | (model only; "Detection Method Carbon Monoxide Sensor") | `ffa05df253267cc36a12df5674fa528ae869afd2f06d4c2314d7b4be987224e0` |
| `hikvision-ds-pdebp1-eg2-we` | DS-PDEBP1-EG2-WE | manual-call-point | ax-pro | (model only; "Accidental press protection") | `7df5de634abf474260620c098f31b6bf3d155701d5a688e054ecfe8628ba1f7e` |
| `hikvision-ds-ps1-e-we` | DS-PS1-E-WE | sounder | ax-pro | "Wireless External Sounder" | `03f95b2f12543c7b59cb2047b8d5c149f5afde6ae2c291e57f33c85929a7007c` |
| `hikvision-hf-s2` | HF-S2 | smoke-detector | standalone | "Photoelectric Smoke Detector" | `f9446216d198cdef3631093daca22094c5fffd68eda454b62f139d723cf78ac8` |

Datasheet URLs (`sourceUrl` of each record):

- DS-PHA48-EP: https://assets.hikvision.com/prd/public/all/doc/m000054763/DS-PHA48-EP_Datasheet_20240118.pdf
- DS-PHA64-LP(B): https://assets.hikvision.com/prd/public/all/doc/m000138169/DS-PHA64-LPB_Datasheet_20240401.pdf
- DS-PM1-I8O2-H: https://assets.hikvision.com/prd/public/all/doc/m000057668/DS-PM1-I8O2-H_Datasheet.pdf
- DS-PK1-LRT-HWE: https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000937/S000000934/OFR001816/M000053265/Data_Sheet/DS-PK1-LRT-HWEHWB_Datasheet.pdf
- DS-PWA96-M-WE: https://assets.hikvision.com/prd/public/all/doc/sm000090683/DS-PWA96-M-WE_Datasheet_20240322.pdf
- DS-PWA96-M2H-WB: https://assets.hikvision.com/prd/public/all/doc/m000052448/DS-PWA96-M2H-WB_Datasheet_20240322.pdf
- DS-PDSMK-S-WE: https://assets.hikvision.com/prd/public/all/doc/m000038138/DS-PDSMK-S-WE_Datasheet.pdf
- DS-PDHT-E-WE: https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000933/S000000935/OFR001514/M000045376/Data_Sheet/DS-PDHT-E-WE_Datasheet_20230724.pdf
- DS-PDCO-E-WE: https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000933/S000000935/OFR001514/M000045376/Data_Sheet/DS-PDCO-E-WE_Datasheet_20230724.pdf
- DS-PDEBP1-EG2-WE: https://assets.hikvision.com/prd/public/all/doc/m000034527/DS-PDEBP1-EG2-WE_Datasheet.pdf
- DS-PS1-E-WE: https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000933/S000000935/OFR000967/M000034336/Data_Sheet/DS-PS1-E-WE_Datasheet.pdf
- HF-S2: https://assets.hikvision.com/prd/normal/all/doc/m000053750/HF-S2_datasheet_20230417.pdf

Per-record notes:

- **Kind of DS-PDHT-E-WE**: the datasheet prints "Detection Method Temperature Sensor"; the
  AX PRO user manual prints "Heat Detector DS-PDHT-E-WE" (PDF page 151). Kind = heat-detector.
- **Kind of DS-PDEBP1-EG2-WE**: it is a portable emergency (panic) button ("Application
  Scenario Portable"), not a fire manual call point to EN 54-11. It is filed under the
  `manual-call-point` kind, whose UI label is "Call point / panic button"; the record's
  `notes` says what it is.
- **HF-S2 standalone**: the datasheet prints "widely used in shops, residences, hotels, rentals
  and other independent scenes", lists no radio and no hub, and sits on hikvision.com under
  `fire-products/standalone-detector/independent-series`. `worksStandalone: true`. The same
  datasheet also covers HF-S2E; only HF-S2 is entered.
- **Capacity (C7)** values are the "Device management" rows (and the "Zones" row) of each
  panel / hub datasheet, copied as printed (label -> value):

| Record | `capacityAsPrinted` rows as printed in the datasheet specification table |
|---|---|
| DS-PHA48-EP | Zones -> "48(8 on-board zones, max 4 wired PIRCAM)"; Tag -> "48"; Keyfob -> "48"; Keypad -> "4"; Wireless sounder -> "8" |
| DS-PHA64-LP(B) | Zones -> "64 (8 On-board zones, max 8 wired PIRCAM)"; Tag -> "64"; Keyfob -> "64"; Keypad -> "8"; Wireless sounder -> "16" |
| DS-PWA96-M-WE | Tag -> "48"; PIR cam -> "Supported"; Zones -> "96 (up to 48 PIRCAMs)"; Keypad -> "8 (including tag reader)"; Wireless sounder -> "6 (3 internal+3 external)"; Wireless repeater -> "4"; Keyfob -> "48"; Multi Transmitter -> "6" |
| DS-PWA96-M2H-WB | Zones -> "Up to 96 (including 48 PIRCAMs & 16 onboard Wired Zones & 2 onboard Wired Outputs)"; Keyfob -> "48"; Wireless sounder -> "6 (3 internal+3 External)"; Keypad -> "8 (Including Tag reader)"; Wireless Repeater -> "4"; Multi Transmitter -> "5"; PIR Cam -> "Supported" |

## Compatibility pairs

Stored once, on the controller record (`compatibleDevices[]`), each with its own source URL.
Only pairs whose two ends are both in this catalog are stored. Source: Hikvision's two
official model-by-model compatibility lists (HTML tables, read 2026-10-07).

### AXPRO Series Compatibility List

https://www.hikvision.com/en/products/Alarm-Products/wireless-intrusion-alarm/ax-pro/axpro-series-compatibility-list/

Columns: "DS-PWAxx Series" firmware V1.2.8, V1.2.9, V1.3.0, V1.3.1, V1.3.2 (√ = supported,
"-" = not supported at that version). Footnote as printed: "DS-PWAxx Series include following
models: DS-PWA48-E-WB, DS-PWA64-L-WB, DS-PWA64-M-WB, DS-PWA96-M-WB, DS-PWA96-M2-WB,
DS-PWA96-M2H-WB / DS-PWA48-E-WE, DS-PWA64-L-WE, DS-PWA64-M-WE, DS-PWA96-M-WE,
DS-PWA96-M2-WE, DS-PWA96-M2H-WE".

| Row as printed | V1.2.8 - V1.3.2 | Stored on |
|---|---|---|
| Wireless External Sounder "DS-PS1-E-WE/WB(red)/(blue)/(amber)" | √ √ √ √ √ | DS-PWA96-M-WE -> DS-PS1-E-WE |
| Wireless Portable Emergency Button "DS-PDEBP1-EG2-WE/WB" | √ √ √ √ √ | DS-PWA96-M-WE -> DS-PDEBP1-EG2-WE |
| Wireless Smoke Detector "DS-PDSMK-S-WE/WB" | √ √ √ √ √ | DS-PWA96-M-WE -> DS-PDSMK-S-WE |
| Wireless Heat Detector "DS-PDHT-E-WE/WB" | √ √ √ √ √ | DS-PWA96-M-WE -> DS-PDHT-E-WE |
| Wireless CO Detector "DS-PDCO-E-WE/WB" | √ √ √ √ √ | DS-PWA96-M-WE -> DS-PDCO-E-WE |

**DS-PWA96-M2H-WB** is in the same series list, but it is the 433 MHz hub (datasheet: "RF
Frequency 433Mhz") and this catalog holds only the 868 MHz `-WE` peripherals (each
peripheral datasheet prints 868 MHz). The list writes each row as "-WE/WB" without saying
which variant goes with which hub, so no `-WE` peripheral is stored for the `-WB` hub; its
record `notes` says so. The matching `-WB` peripherals are not in the catalog.

### AX HYBRID PRO V1 Device Compatibility List (V1.1.2)

https://www.hikvision.com/en/products/Alarm-Products/wired-intrusion-alarm/ax-hybrid-pro/ax-hybrid-pro-device-compatibility-list/

Table 1-1 (wireless devices) columns: "Control Panel" [DS-PHA48-EP, DS-PHA64-LP] |
[DS-PHA48-EP(B), DS-PHA64-LP(B)] | "Bus Wireless Receiver" [DS-PM1-RT-HWE, DS-PM1-RT-HWB].
Footnote: "Requires specific version of bus wireless receiver as show in the table".
Table 1-2 (bus and other devices) has the two control-panel columns only. Cells are a minimum
firmware version or "—". Catalog record DS-PHA48-EP reads the first column, DS-PHA64-LP(B)
the second.

| Row as printed | DS-PHA48-EP / DS-PHA64-LP | DS-PHA48-EP(B) / DS-PHA64-LP(B) | Bus wireless receiver | Stored |
|---|---|---|---|---|
| Speed-X Bus LCD Keypad "DS-PK1-LRT-HWE DS-PK1-LRT-HWB" | V1.0.2 build 220719 or later | V1.1.0 build 240409 or later | (table 1-2) | both panels |
| Speed-X Bus Input Expander "DS-PM1-I8O2-H" | V1.0.2 build 220719 or later | V1.1.0 build 240409 or later | (table 1-2) | both panels |
| Wireless Heat Detector "DS-PDHT-E-WE DS-PDHT-E-WB" | V1.1.2 build 250808 or later | V1.1.2 build 250808 or later | V1.0.7 build 250524 or later | both panels |
| Wireless CO Detector "DS-PDCO-E-WE DS-PDCO-E-WB" | V1.1.2 build 250808 or later | V1.1.2 build 250808 or later | V1.0.7 build 250524 or later | both panels |
| Wireless Portable Emergency Button "DS-PDEBP1-EG2-WE DS-PDEBP1-EG2-WB" | V1.0.2 build 220719 or later | V1.1.0 build 240409 or later | V1.0.1 build 220723 or later | both panels |
| Wireless External Sounder "DS-PS1-E-WE/RED DS-PS1-E-WE/BLUE DS-PS1-E-WE/AMBER ..." | V1.0.2 build 220719 or later | V1.1.0 build 240409 or later | V1.0.1 build 220723 or later | both panels |
| Wireless Smoke Detector "DS-PDSMK-S-WE DS-PDSMK-S-WB" | — | — | — | NOT stored |

Each stored entry's `note` carries the minimum panel firmware and, for wireless devices, the
bus wireless receiver DS-PM1-RT-HWE and its minimum firmware (the receiver is not in this
catalog).

Open points, stated plainly:

- The page prints no legend for "—". Because the DS-PDSMK-S-WE row is "—" in every column,
  no AX Hybrid PRO entry is stored for it, and the app shows that smoke detector as "not
  listed" for the Hybrid panels. (The DS-PDSMK-E-WE smoke detector does carry versions on
  this list, but it is not in the catalog.)
- The lists change with firmware releases; the stored versions are those shown on 2026-10-07.
- Earlier evidence, superseded by the lists above and consistent with them: the keypad
  datasheet ("designed for AX hybrid pro control panel (DS-PHA48-EP, DS-PHA64-LP)"), the
  expander datasheet ("wired zone expander for AX Hybrid Pro control panel") and appendix G
  of the AX PRO user manual
  (https://assets.hikvision.com/prd/public/all/doc/m000052447/UD25814B_Baseline_AX-PRO-_User-Manual_v2.0.1_20241024.pdf,
  SHA-256 `4e3061e410c2296ea619c22aedff455335d35126b70e0e78a5692cf3f1b5d490`), which lists the
  same five peripherals.

"Not listed" in the app means "no official statement was found", never "proven incompatible".

## TCVN 5738:2021 table

Standard: TCVN 5738:2021 "Phòng cháy chữa cháy - Hệ thống báo cháy tự động - Yêu cầu kỹ thuật",
3rd edition, replaces TCVN 5738:2001. The standard's text is not stored in this repository;
only the numbers below.

Source of the numbers (owner decision 2026-10-07): the full-text reprint on dulieuphapluat.vn,
read on 2026-10-07. The app links to this page wherever a TCVN circle is explained
(`TCVN_5738_SOURCE_URL`), so the user can open the document the drawing is based on.

- https://dulieuphapluat.vn/van-ban/tai-nguyen-moi-truong-van-ban/tieu-chuan-quoc-gia-tcvn-57382021-ve-phong-chay-chua-chay-he-thong-bao-chay-tu-dong-yeu-cau-ky-thuat-1152408.html

Cross-check only (agrees on every cell, clause number and table number): a full-document PDF
copy at https://ducthuan.vn/wp-content/uploads/2023/05/TCVN-5738_2021.pdf
(SHA-256 `fba7768753aa4e5fe0e523aef2bd5d42cc421a609e989dfedad383e2d19741a9`), tables on PDF pages 15-16.

Clause 6.13, **Bảng 1** - point smoke detectors:

| Height of the protected area (m) | Average protected area per detector (m2) | Max distance between detectors (m) | Max distance detector to wall (m) |
|---|---|---|---|
| Đến 3,5 (up to 3.5) | Đến 85 | 9,0 | 4,5 |
| Lớn hơn 3,5 đến 6,0 | Đến 70 | 8,5 | 4,0 |
| Lớn hơn 6,0 đến 10 | Đến 65 | 8,0 | 4,0 |
| Lớn hơn 10 đến 12 | Đến 55 | 7,5 | 3,5 |

Clause 6.15.1, **Bảng 2** - point heat detectors:

| Height of the protected area (m) | Average protected area per detector (m2) | Max distance between detectors (m) | Max distance detector to wall (m) |
|---|---|---|---|
| Đến 3,5 (up to 3.5) | Đến 25 | 5,0 | 2,5 |
| Lớn hơn 3,5 đến 6,0 | Đến 20 | 4,5 | 2,0 |
| Lớn hơn 6,0 đến 9,0 | Đến 15 | 4,0 | 2,0 |

Conditions printed with the tables and NOT modelled by the app:

- Both clauses: the table values apply "but not larger than the values in the detector's own
  technical documents". No shipped datasheet prints such a value.
- Clause 6.5: ceiling projections of 0.08-0.4 m reduce the protected area by 25 %; deeper than
  0.4 m and narrower than 0.75 m by 40 %; deeper than 0.4 m and at least 0.75 m wide need extra
  detectors.
- Clause 6.6: in spaces narrower than 3 m, under raised floors or above false ceilings below
  1.7 m, the Bảng 1 spacing may be multiplied by 1.5.
- No table for CO detectors. Combined smoke-heat detectors follow Bảng 2.

The app draws a circle of equal area (`r = sqrt(A / pi)`) from the area column. That is an
approximation of an area + grid rule: circles on a compliant grid leave gaps at the corners.

Not checked / not used:

- No amendment to TCVN 5738:2021 was seen in either source, but this was not confirmed against
  the official standards catalogue.
- A third copy, https://vfra.org/uploads/up/root/file/2022/12/16/19/42/5_t1671172958_0881.pdf
  (SHA-256 `57061879f7d5eede4440bc812f4ba83ed839ff9070a120005faf6883f95aa9a6`), carries the same
  title page but numbers these clauses 5.13 / 5.15 and the heat table "Bảng 3", and words the
  heat bands "Dưới 3,5" / "Từ 3,5 đến 6,0". All area, spacing and wall-distance numbers are
  the same; only a ceiling of exactly 3.5 m would land in a different heat band. It looks like
  a pre-publication text and is not used.

## Zero-record kinds and lines

- **Dedicated fire-alarm panels and their devices (HF-C108 and other HF-C\*)**: product pages
  exist on hikvision.com, but no datasheet PDF was downloaded and read. Zero records.
- **Wired smoke / heat detectors for AX Hybrid PRO**: no official datasheet found. Zero records.
- **Standalone heat / CO detectors**: none found on the accepted hosts. Zero records.

## Found but not entered

| Candidate | Reason |
|---|---|
| DS-PHA48-EP(B) | Datasheet downloaded (SHA-256 `8c4b595d8358abb35f42318657ca1af25e3d9cc8992310e500d045a6460ed222`); a second variant of the same panel, left out to keep the first set small. |
| DS-PDEB1-EG2-WB(B) | Datasheet downloaded; 433 MHz emergency button, no printed pairing with a shipped hub. |
| DS-PDSMK-E-WE, DS-PS1-I-WE, DS-PS1-EV-WE | Named in the AX PRO manual; datasheets not downloaded. |
| HF-S2E | Second model on the HF-S2 datasheet; not entered. |
| HF-C108, HF-CS1, HF-CH1, HF-CMP1 | Product pages only, no datasheet read. |

## Prices and `purchaseLinks`

Same rule as the other catalogs: a Vietnamese shop page that displays a VND price for the exact
model, else `null`. Searched 2026-10-07 (vuhoangtelecom, mastery, thanhlinh, vietnamsmart,
abaro, phocongnghe + open search per model).

| Record | Result |
|---|---|
| DS-PWA96-M2H-WB | `priceVn` and `purchaseLinks.secondary` (same value, as for priced sensors): vuhoangtelecom, 7.350.000đ displayed selling price (crossed-out list price 10.500.000đ, not used), https://vuhoangtelecom.vn/san-pham/tu-bao-dong-ax-hybrid-panel-96-vung-hikvision-ds-pwa96-m2h-wb/ . The shop titles it "AX Hybrid Panel"; the SKU is the exact model. |
| DS-PHA48-EP, DS-PHA64-LP(B), DS-PM1-I8O2-H, DS-PK1-LRT-HWE | `null` - shop pages show "Liên hệ" (contact for price). |
| DS-PWA96-M-WE, DS-PDSMK-S-WE, DS-PDHT-E-WE, DS-PDCO-E-WE, DS-PDEBP1-EG2-WE, DS-PS1-E-WE, HF-S2 | `null` - no Vietnamese shop page found for the exact model (`-WB` variants are not the same model). |

No Shopee listing was found for any record.

## PDF handling

PDFs are downloaded to a scratch directory outside the repository and never committed. The
SHA-256 values let anyone re-download a URL and confirm byte-identical content.
