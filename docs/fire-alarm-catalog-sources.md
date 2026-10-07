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

## AX HYBRID PRO list devices sold in Vietnam

Owner decisions (2026-10-07):

- Add every device of Hikvision's "AX HYBRID PRO Device Compatibility List" that is **sold in
  Vietnam** - a Vietnamese shop page for the exact model, with a price or "Liên hệ" (contact
  for price), or a Shopee listing - and has an official datasheet.
- A "—" cell on that list is read as "compatible with every firmware version" (the page prints
  no legend; this is the owner's reading). Such entries carry that sentence in their `note`.
- Motion and glass-break detectors go to the sensor catalog (see `sensor-catalog-sources.md`);
  everything else is a marker-only device in this catalog.

Method, all on 2026-10-07: every model string of the list (193 after dropping colour
suffixes, plus the four controllers) was searched on vuhoangtelecom.vn and mastery.vn; a hit
counts only when the product page title or SKU carries the exact model string ("(B)" and
`-WE` / `-WB` are distinct models). The product page HTML was saved as evidence. For each
model sold, the datasheet was taken from its hikvision.com product page (or a
hikvision.com-restricted search), downloaded, and accepted only when the PDF text contains
the exact model string. Shopee pages cannot be fetched, so no Shopee listing is recorded and
`purchaseLinks.primary` is `null` for every record.

Result: 50 models sold in Vietnam, 44 with a datasheet. Four were already in the
catalog; 28 records were added here and twelve in the sensor catalog.

| Record id | Model | Kind | Datasheet (`sourceUrl`) | SHA-256 | Price | Shop page |
|---|---|---|---|---|---|---|
| `hikvision-ds-pdmc-eg2-wb` | DS-PDMC-EG2-WB | magnetic-contact | https://assets.hikvision.com/prd/public/all/doc/m000039123/DS-PDMC-EG2-WB_Datasheet_V1.0_202303.pdf | `68d88532bd9471817051c8e45b089ef300d7943b9aa1ec2258df508f7c012a67` | 750.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/cong-tac-tu-ket-noi-dau-bao-co-day-hikvision-ds-pdmc-eg2-wb/ |
| `hikvision-ds-pdmc-eg2-wb-b` | DS-PDMC-EG2-WB(B) | magnetic-contact | https://assets.hikvision.com/prd/normal/all/doc/sm000092422/DS-PDMC-EG2-WBB_Datasheet_20260923.pdf | `e0623cb8e0af22404e6103b8c137efbd3fda35f6827c8ed5c9614269b83e00df` | contact for price (mastery) | https://mastery.vn/sanpham/cong-tac-tu-khong-day-hikvision-ds-pdmc-eg2-wbb/ |
| `hikvision-ds-pdmcs-eg2-wb` | DS-PDMCS-EG2-WB | magnetic-contact | https://assets.hikvision.com/prd/public/all/doc/m000039122/DS-PDMCS-EG2-WB_Datasheet_V1.0_202303.pdf | `1d8d346df9e028c81c6b92ffc401442bca8f33fe8303582b0c2390e59c958852` | 620.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/cong-tac-tu-khong-day-433-mhz-hikvision-ds-pdmcs-eg2-wb/ |
| `hikvision-ds-pdmck-eg2-wb-b` | DS-PDMCK-EG2-WB(B) | magnetic-contact | https://assets.hikvision.com/prd/normal/all/doc/m000115121/DS-PDMCK-EG2-WBB_Datasheet_20260923.pdf | `3643e0585d4e5dd2fce91a11030e85614c183738beb2966265b33f0a2f2a4101` | contact for price (mastery) | https://mastery.vn/sanpham/cong-tac-tu-ket-hop-bao-rung-hikvision-ds-pdmck-eg2-wbb/ |
| `hikvision-ds-pdmcx-e-wb` | DS-PDMCX-E-WB | magnetic-contact | https://assets.hikvision.com/prd/normal/all/doc/m000043792/DS-PDMCX-E-WB_Datasheet_V1.0_202303.pdf | `362a8d2baa4043a0a86f77b6098dc608b1d516f95da8f383a352334b163332fc` | contact for price (mastery) | https://mastery.vn/sanpham/cam-bien-tu-khong-day-hikvision-ds-pdmcx-e-wb/ |
| `hikvision-ds-pdtph-e-wb` | DS-PDTPH-E-WB | environment-detector | https://assets.hikvision.com/prd/normal/all/doc/m000044576/DS-PDTPH-E-WB_Datasheet_V1.0_202303.pdf | `b762d629cebf02fcdefb146aa78119ca2f60bca9ef9bcad423369a6fc5d6ea8f` | contact for price (mastery) | https://mastery.vn/sanpham/may-do-nhiet-do-khong-day-hikvision-ds-pdtph-e-wb/ |
| `hikvision-ds-pdsmk-s-wb` | DS-PDSMK-S-WB | smoke-detector | https://assets.hikvision.com/prd/public/all/doc/m000045417/DS-PDSMK-S-WB_Datasheet_V1.0_202303.pdf | `4d2794529c5be5870f9579b97f8896800de1d4bfc2c7c5bf927e439dafbe8e5d` | 1.470.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/cam-bien-bao-khoi-khong-day-hikvision-ds-pdsmk-s-wb/ |
| `hikvision-ds-pdsmk-e-wb` | DS-PDSMK-E-WB | smoke-detector | https://assets.hikvision.com/prd/normal/all/doc/m000050558/DS-PDSMK-E-WB_Datasheet_20230724.pdf | `7474d79f6fdc7e0295da280728866735153eeadd048bb6af4992428d259faf41` | contact for price (mastery) | https://mastery.vn/sanpham/cam-bien-khoi-khong-day-hikvision-ds-pdsmk-e-wb/ |
| `hikvision-ds-pdht-e-wb` | DS-PDHT-E-WB | heat-detector | https://assets.hikvision.com/prd/normal/all/doc/m000050559/DS-PDHT-E-WB_Datasheet_20230724.pdf | `495db86f1d09c700b64a12e8d36a21dc00a4c7222cca31688c45eb91ad58bc04` | contact for price (mastery) | https://mastery.vn/sanpham/cam-bien-nhiet-do-hikvision-ds-pdht-e-wb/ |
| `hikvision-ds-pdco-e-wb` | DS-PDCO-E-WB | co-detector | https://assets.hikvision.com/prd/normal/all/doc/m000050560/DS-PDCO-E-WB_Datasheet_20230724.pdf | `ec365b8472ecad3472d4fe57a6c479009d38fe464953d9e47e1f4888b0389ffa` | contact for price (mastery) | https://mastery.vn/sanpham/cam-bien-carbon-monoxide-hikvision-ds-pdco-e-wb/ |
| `hikvision-ds-pk1-lt-wb` | DS-PK1-LT-WB | keypad | https://assets.hikvision.com/prd/public/all/doc/sm000096643/DS-PK1-LT-WB_Datasheet_V1.0_202303.pdf | `885be271a34151aad1fccef601925f38aee14e4740af3c565e1dd796c05f6db0` | 2.720.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/ban-phim-khong-day-hikvision-ds-pk1-lt-wb/ |
| `hikvision-ds-pk1-lrt-hwb` | DS-PK1-LRT-HWB | keypad | https://assets.hikvision.com/prd/normal/all/doc/m000053265/DS-PK1-LRT-HWEHWB_Datasheet.pdf | `00f8514aa022affb95d8d59c730f5b88bef546b0b5c51685bb8898b59cb2bc5c` | contact for price (mastery) | https://mastery.vn/sanpham/ban-phim-lcd-co-day-hikvision-ds-pk1-lrt-hwb/ |
| `hikvision-ds-pkf1-wb` | DS-PKF1-WB | keyfob | https://assets.hikvision.com/prd/public/all/doc/m000038135/DS-PKF1-WB_Datasheet_V1.0_202303.pdf | `bc71566aa4156db57eb61ed92ed691ad1802c1870ab3d136caa696bbe9d6c232` | 700.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/dieu-khien-tu-xa-hikvision-ds-pkf1-wb/ |
| `hikvision-ds-pdeb1-eg2-wb` | DS-PDEB1-EG2-WB | manual-call-point | https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000933/S000000935/OFR000937/M000039129/Data_Sheet/DS-PDEB1-EG2-WB_Datasheet_20201201.pdf | `e7b6f1fdc5865028193efd92fd1565d0af9f037d21d6c0626cb47db17cbaf819` | 589.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/nut-an-bao-dong-khan-cap-hikvision-ds-pdeb1-eg2-wb/ |
| `hikvision-ds-pdeb1-eg2-wb-b` | DS-PDEB1-EG2-WB(B) | manual-call-point | https://assets.hikvision.com/prd/public/all/doc/m000056570/DS-PDEB1-EG2-WBB_Datasheet_V1.0_202303.pdf | `9c4e25cd3f1deb6e1d740d038d2c1c69f2f5e31376c7c15bdfe2109ad20f7ffb` | contact for price (mastery) | https://mastery.vn/sanpham/nut-an-bao-dong-khan-cap-hikvision-ds-pdeb1-eg2-wbb/ |
| `hikvision-ds-pdeb2-eg2-wb-b` | DS-PDEB2-EG2-WB(B) | manual-call-point | https://assets.hikvision.com/prd/normal/all/doc/m000056571/DS-PDEB2-EG2-WBB_Datasheet_V1.0_202303.pdf | `34bde7a65d170624aa34e474786a9cc635b391e1c519a49431f8bcfee84ef95d` | contact for price (mastery) | https://mastery.vn/sanpham/nut-an-bao-dong-khan-cap-hikvision-ds-pdeb2-eg2-wbb/ |
| `hikvision-ds-pdebp1-eg2-wb` | DS-PDEBP1-EG2-WB | manual-call-point | https://assets.hikvision.com/prd/normal/all/doc/m000039127/DS-PDEBP1-EG2-WB_Datasheet_V1.0_202303.pdf | `03b878c2810d8ed0ac895742f4ddd474c082f52ba1eac3d8c10a22a1c8a633fc` | contact for price (mastery) | https://mastery.vn/sanpham/nut-an-bao-dong-khan-cap-hikvision-ds-pdebp1-eg2-wb/ |
| `hikvision-ds-pdebp2-eg2-wb` | DS-PDEBP2-EG2-WB | manual-call-point | https://assets.hikvision.com/prd/public/all/doc/m000039128/DS-PDEBP2-EG2-WB_Datasheet_V1.0_202303.pdf | `428fbc891d8274cfd366d85a4919b60b9e6c51d7d60af3e67136b5bc171abf02` | contact for price (mastery) | https://mastery.vn/sanpham/nut-an-khan-cap-khong-day-hikvision-ds-pdebp2-eg2-wb/ |
| `hikvision-ds-ps1-i-wb` | DS-PS1-I-WB | sounder | https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000933/S000000935/OFR001820/M000038133/Data_Sheet/DS-PS1-I-WB_Datasheet_V1.0_202303.pdf | `78d87ddffd2d8f7cba4dd4433cee3ecf667da2d275a6fc5767ca052d6f81dc55` | 1.180.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/loa-bao-dong-khong-day-trong-nha-hikvision-ds-ps1-i-wb/ |
| `hikvision-ds-ps1-ii-wb` | DS-PS1-II-WB | sounder | https://assets.hikvision.com/prd/public/all/doc/m000055800/DS-PS1-II-WB_Datasheet_V1.0_202303.pdf | `23a03f7647cdac116df26031b62fa027fd49f63f3917bf009e35ec8df0aa6f56` | contact for price (mastery) | https://mastery.vn/sanpham/loa-bao-dong-khong-day-trong-nha-hikvision-ds-ps1-ii-wb/ |
| `hikvision-ds-ps1-e-wb` | DS-PS1-E-WB | sounder | https://assets.hikvision.com/prd/public/all/doc/m000038134/DS-PS1-E-WB_Datasheet_20250416.pdf | `39496532ac42927ac3c712ab2a60038612b007ec02532115879af9aaf2c9936e` | 2.120.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/loa-bao-dong-khong-day-trong-nha-hikvision-ds-ps1-e-wb/ |
| `hikvision-ds-pm1-o1h-wb` | DS-PM1-O1H-WB | relay-module | https://assets.hikvision.com/prd/normal/all/doc/m000038132/DS-PM1-O1H-WB_Datasheet_20251209.pdf | `fe2497d4a29425ea83bcd2e890c63262095917c6f31cd3d23500cd3e86653a0c` | 880.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/thiet-bi-pgm-khong-day-hikvision-ds-pm1-o1h-wb/ |
| `hikvision-ds-pm1-o4l-h` | DS-PM1-O4L-H | relay-module | https://assets.hikvision.com/prd/normal/all/doc/m000065234/DS-PM1-O4L-H_Datasheet_V1.0_202207.pdf | `f7d43bf46b646c9225c89d23c526170763ba7ab5ad8d123b7785decfede47007` | contact for price (mastery) | https://mastery.vn/sanpham/bo-mo-rong-relay-co-day-hikvision-ds-pm1-o4l-h/ |
| `hikvision-ds-pr1-wb` | DS-PR1-WB | repeater | https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000937/S000000941/OFR000965/M000038136/Data_Sheet/DS-PR1-WB.pdf | `1e84d114403d707ab563c193ef76b61c23c6e1ef3c68b721c9819d4e1eb2456a` | 2.180.000đ (vuhoangtelecom) | https://vuhoangtelecom.vn/san-pham/bo-khuech-dai-tin-hieu-khong-day-hikvision-ds-pr1-wb/ |
| `hikvision-ds-pm1-rt-hwb` | DS-PM1-RT-HWB | expander-module | https://assets.hikvision.com/prd/normal/all/doc/m000059783/DS-PM1-RT-HWB_Datasheet_20220616.pdf | `30b86f960c575e3c9903343bfe17942426690cbac11dbb5bc55202f0367e066a` | contact for price (mastery) | https://mastery.vn/sanpham/bo-thu-khong-day-hikvision-ds-pm1-rt-hwb/ |
| `hikvision-ds-pm2-p` | DS-PM2-P | communicator | https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000937/S000000934/OFR001533/M000057368/Data_Sheet/DS-PM2-P_datasheet.doc.pdf | `a3769625fb5670f1893f5b0f4c66b842eab008c2b7a14cced0a68ecb2e397358` | contact for price (mastery) | https://mastery.vn/sanpham/module-giao-tiep-pstn-hikvision-ds-pm2-p/ |
| `hikvision-ds-pm2-g` | DS-PM2-G | communicator | https://assets.hikvision.com/prd/normal/all/doc/m000057367/DS-PM2-G_datasheet.doc.pdf | `89cab9f7296381e9eab8c3573ec975d81b6a72ee1ffecf004a1d4d9816db1a86` | contact for price (mastery) | https://mastery.vn/sanpham/module-giao-tiep-gprs-hikvision-ds-pm2-g/ |
| `hikvision-ds-pm2-s-au` | DS-PM2-S(AU) | communicator | https://assets.hikvision.com/prd/normal/all/doc/m000057365/DS-PM2-SAU_datasheet.doc.pdf | `cfbff9a6bf3afc030af2d96ed6fa2233116c8459c1a7bfd21c94264e79b626d0` | contact for price (mastery) | https://mastery.vn/sanpham/module-giao-tiep-3g-4g-hikvision-ds-pm2-sau/ |

Notes:

- `certificationsAsPrinted` is `[]` for all of them: none of these datasheets prints a
  certification line.
- Emergency buttons are filed under `manual-call-point` ("Call point / panic button"), the
  bus wireless receiver DS-PM1-RT-HWB under `expander-module`, the wall switch and the relay
  expander under `relay-module`.
- Existing records DS-PHA64-LP(B), DS-PK1-LRT-HWE and DS-PM1-I8O2-H gained a mastery.vn
  contact-for-price link; DS-PHA48-EP and the 868 MHz (`-WE`) records were not found in a
  Vietnamese shop and keep `purchaseLinks: null`.

Sold in Vietnam but NOT added - no datasheet for the exact model could be downloaded:
DS-PDP15P-EG2-WB, DS-PDC15-EG2-WB, DS-PDPC12PF-EG2-WB, DS-PDPC12PF-EG2-WB(B), DS-PDMCK-EG2-WB, DS-PK1-E-WB.

Not found in either shop (143 model strings, not added): DS-PDP15P-EG2-WE, DS-PDP15P-EG2-WE(B), DS-PDCL12-EG2-WE, DS-PDCL12-EG2-WB, DS-PDCL12-EG2-WE(B), DS-PDCL12-EG2-WB(B), DS-PDP18-HM-WE, DS-PDC15-EG2-WE, DS-PDC15-EG2-WE(B), DS-PDC10AM-EG2-WE, DS-PDD12P-EG2-WE, DS-PDD12P-EG2-WE(B), DS-PDD12P-EG2-WB(B), DS-PDC10DM-EG2-WE, DS-PDTT15AM-LM-WE, DS-PDQP15AM-LM-WE, DS-PD201P10-WE, DS-PD201P10-WB, DS-PDPC12P-EG2-WE, DS-PDPC12P-EG2-WE(B), DS-PDPC12P-EG2-WB(B), DS-PDPC12PF-EG2-WE, DS-PDPC12PF-EG2-WE(B), DS-PDPC18-HM-WE, DS-PDPC18-HM-WB, DS-PD201PC10-WE, DS-PD201PC10-WB, DS-PDMC-EG2-WE, DS-PDMC-EG2-WE(B), DS-PDMCS-EG2-WE, DS-PDMCS-EG2-WE(B), DS-PDMCS-EG2-WB(B), DS-PDMCK-EG2-WE, DS-PDMCK-EG2-WE(B), DS-PDMCX-E-WE, DS-PD201MC-WE, DS-PD201MC-WB, DS-PDBG8-EG2-WE, DS-PDPG12P-EG2-WE, DS-PDPG12P-EG2-WE(B), DS-PDPG12P-EG2-WB(B), DS-PDWL-E-WE, DS-PDWL-E-WB, DS-PDWL-E-WE(B), DS-PDWL-E-WB(B), DS-PDTPH-E-WE, DS-PDTPH-E-WE(B), DS-PDTPH-E-WB(B), DS-PDSMK-S-WE, DS-PDSMK-E-WE, DS-PDHT-E-WE, DS-PDCO-E-WE, DS-PD451SMK-WE, DS-PD451SMK-WB, DS-PD452SMK-WE, DS-PD452SMK-WB, DS-PK1-E-WE, DS-PK201B-WE, DS-PK201B-WB, DS-PK1-LT-WE, DS-PKF1-WE, DS-PKF1-WE(B), DS-PKF1-WB(B), DS-PKF401-WE, DS-PKF401-WB, DS-PKF201-WE, DS-PKF201-WB, DS-PT1-WE, DS-PT1-WB, DS-PT1-WE(B), DS-PT1-WB(B), DS-PT-M1, DS-PTS-MF, DS-PDEB1-EG2-WE, DS-PDEB1-EG2-WE(B), DS-PDEB2-EG2-WE, DS-PDEB2-EG2-WB, DS-PDEB2-EG2-WE(B), DS-PD401B1X-WE, DS-PD401B1X-WB, DS-PD401B2X-WE, DS-PD401B2X-WB, DS-PDEBP1-EG2-WE, DS-PDEBP1-EG2-WE(B), DS-PDEBP1-EG2-WB(B), DS-PDEBP2-EG2-WE, DS-PDEBP2-EG2-WE(B), DS-PDEBP2-EG2-WB(B), DS-PS1-I-WE, DS-PS1-I-WE(B), DS-PS1-I-WB(B), DS-PS1-II-WE, DS-PS403I-WE, DS-PS403I-WB, DS-PS1-E-WE, DS-PS201-WE, DS-PS201-WB, DS-PM1-O1L-WE, DS-PM1-O1L-WB, DS-PM1-O1H-WE, DS-PM401R2H-WE, DS-PM401R2H-WB, DS-PSP1-WE, DS-PSP1-WB, DS-PM1-I1-WE, DS-PM1-I1-WB, DS-PM1-I16O2-WE, DS-PM1-I16O2-WB, DS-PR1-WE, DS-PR1-WE(B), DS-PR1-WB(B), DS-PD512DT15, DS-PD512DT15AM, DS-PD501PC12, DS-PD540MCK, DS-PK501LTM-HWE, DS-PK501LTM-HWB, DS-PK502MDX, DS-PK670W, DS-PK670MDWNP, DS-PK670MDW-HWE, DS-PK670MDW-HWB, DS-PM501Z8T4, DS-PM501R4, DS-PR501-HWE, DS-PR501-HWB, DS-PR511-4, DS-PR521, DS-PM1-O4H-H, DS-PM1-RT-HWE, DS-PM2-S(EU), DS-PC501G, DS-PC502S(AU), DS-PC502S(EU), DS-PC201N, DS-PC201F, DS-PM1-D, DS-PM2-D, DS-PR531-3A, DS-PDCM15PF-IR, DS-PT061, DS-PHA48-EP, DS-PWA96-M-WE.

### Compatibility entries after this pass

Rebuilt by script from the two official lists for every catalog model that appears on them:
DS-PHA48-EP 47 entries and DS-PHA64-LP(B) 47 entries (AX HYBRID PRO list, first / second
panel column; wireless devices name the bus wireless receiver and its minimum firmware),
DS-PWA96-M-WE 5 entries (AXPRO Series list, `-WE` models), DS-PWA96-M2H-WB 33 entries
(AXPRO Series list, `-WB` models). Counts include the twelve sensor-catalog detectors
(entries may point at a sensor-catalog id). The AXPRO list writes rows as "-WE/WB";
each variant is attached to the hub of the same frequency (868 MHz hub <-> `-WE`, 433 MHz hub
<-> `-WB`), which is a reading of the printed frequencies, not a printed statement.

This supersedes two statements above: the smoke detector DS-PDSMK-S-WE IS now stored for the
AX Hybrid PRO panels (its "—" row, owner's reading), and DS-PWA96-M2H-WB now has entries (the
`-WB` peripherals are in the catalog).

## Wired devices sold in Vietnam (second pass)

Owner request (2026-10-07): add more wired devices. The two shops' Hikvision alarm listings were
paged through (product search on vuhoangtelecom.vn and mastery.vn, product pages saved); 31
wired models not yet in a catalog were found. A model is added only with an official datasheet
whose text contains the exact model string. hikvision.com answered HTTP 403 for product pages
during this pass, so only datasheets reachable by a direct URL (from a hikvision.com-restricted
search) could be downloaded.

| Record id | Model | Kind | Printed values used | Datasheet | SHA-256 | Shop |
|---|---|---|---|---|---|---|
| `hikvision-ds-pd1-mc-rs` | DS-PD1-MC-RS | magnetic-contact | - | https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000601/S000000937/S000000934/OFR000943/M000004980/Data_Sheet/DS-PD1-MC-RS.pdf | `eecc15f018a9c05e577b7fb8218ff57ed6aa50b0acae14f164796ef4d7aef9a4` | contact for price (mastery) https://mastery.vn/sanpham/cam-bien-tu-co-day-hikvision-ds-pd1-mc-rs/ |
| `hikvision-ds-pha48-ep-b` | DS-PHA48-EP(B) | control-panel | capacity: "Zones 48(8 on-board zones, max 4 wired PIRCAM)", "Tag 48", "Keyfob 48", "Keypad 4", "Wireless sounder 8" | https://assets.hikvision.com/prd/public/all/doc/m000138168/DS-PHA48-EPB_Datasheet_20240401.pdf | `8c4b595d8358abb35f42318657ca1af25e3d9cc8992310e500d045a6460ed222` | contact for price (mastery) https://mastery.vn/sanpham/bang-dieu-khien-ax-hybrid-pro-hikvision-ds-pha48-epb/ |

- DS-PHA48-EP(B) is the second-column panel of the AX HYBRID PRO list; its compatibility entries
  are built from that column, like DS-PHA64-LP(B).
- DS-PHA20-W2P (older AX Hybrid panel, datasheet downloaded) was entered and then removed on
  the owner's decision: the list does not cover it, so it would flag every device as "not listed".
- DS-PD1-MC-RS is a wired zone device that is on neither official list: no panel lists it, so
  the app shows it as "not listed" next to any panel.
- The three wired motion detectors of this pass are in `sensor-catalog-sources.md`.

Sold in Vietnam but NOT added - owner decision 2026-10-07: treated as having no valid datasheet
(none could be downloaded for the exact model;
DS-PDD12-EG2 was rejected because the only PDF found is the DS-PDD12P-EG2 datasheet):
DS-PD1-BG9, DS-PD1-EB, DS-PD1-MC-MS, DS-PD1-SKM, DS-PDBG8-EG2, DS-PDCL12-EG2, DS-PDCL12DT-EG2, DS-PDD12-EG2, DS-PDP18-EG2, DS-PDSKM-VG3, DS-PDSMK-4, DS-PHA64-M, DS-PK-L, DS-PK-LRT, DS-PKG-H4L, DS-PKG-H8L, DS-PM-RSI8, DS-PM-RSO8, DS-PM-RSO8-H, DS-PMA-BELL, DS-PMA-G2, DS-PMA-P, DS-PMA-S1, DS-PS1-R, DS-19K00-Y.
