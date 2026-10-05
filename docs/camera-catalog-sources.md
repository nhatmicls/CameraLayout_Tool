# Camera Catalog Sources (Phase 2 provenance)

Every record in `src/catalog/data/*.json` is transcribed directly from an official
manufacturer datasheet PDF. This doc is the audit trail: for each model, the exact
URL downloaded, the retrieval date, the datasheet page where HFOV and max resolution
were read, and a SHA-256 of the PDF bytes (so the exact document version is pinned
even though the PDF itself is not committed - see "PDF handling" below).

Method: `curl -A "Mozilla/5.0 ..." -L -o file.pdf "<url>"` -> verify `%PDF` header and
page count -> `pdftotext -layout` (cross-checked with `-raw` where `-layout`
misaligned a two-column row) -> values copied from the extracted text, never from
memory, resellers, or the two prior research-agent reports (which are hints only).

Retrieval date for all rows below: **2026-10-05**.

## PDF handling

PDFs are not committed to the repository (copyright, binary size - matches
phase plan). They were downloaded to a local scratch directory for this session
only. The SHA-256 below lets anyone re-download the same `sourceUrl` and confirm
they have byte-identical content to what was actually read.

---

## Hikvision (4 models, 8 records)

| Record id | Model | Lens | HFOV source | Max res. source | Illumination source | DORI source | SHA-256 |
|---|---|---|---|---|---|---|---|
| hikvision-ds-2cd2143g2-i-2.8mm | DS-2CD2143G2-I | 2.8mm | p.2 "Lens: 2.8 mm, horizontal FOV 103°" | p.2 "Max. Resolution: 2688×1520" | p.2 "IR... Up to 30 m", "850 nm" | p.2 "DORI: 2.8 mm, D:67m O:26m R:13m I:6m" | `b83491f396a0bb86b01a56eb1c5e6f0dde584e39cb9dfec802df72748ca6097c` |
| hikvision-ds-2cd2143g2-i-4mm | DS-2CD2143G2-I | 4mm | p.2 "4 mm, horizontal FOV 84°" | p.2 (same table) | p.2 (same IR spec, shared by both lens options) | p.2 "4 mm, D:80m O:31m R:16m I:8m" | (same file as above) |
| hikvision-ds-2cd2387g2-lsu-sl-2.8mm | DS-2CD2387G2-LSU/SL | 2.8mm | p.2 "2.8 mm, horizontal FOV 102°" | p.2 "High quality imaging with 8 MP"; frame-rate table "24 fps (3840×2160)" | p.2 "DORI / Up to 30 m" (ColorVu white-light row) | not printed (ColorVu datasheets omit DORI) -> `null` | `cc48a9d8f69b0586c689879bb299bdd74a35eaa0ced2baa7ddacb4f3b78190fd` |
| hikvision-ds-2cd2387g2-lsu-sl-4mm | DS-2CD2387G2-LSU/SL | 4mm | p.2 "4 mm, horizontal FOV 88°" | p.2 (same table) | p.2 (same row) | not printed -> `null` | (same file as above) |
| hikvision-ds-2cd2t47g2-l-2.8mm | DS-2CD2T47G2-L | 2.8mm | p.2 "2.8 mm, horizontal FOV 112°" | p.2 "Max. Resolution 2688×1520" | p.2 raw-mode: "White Light Range 60 m" (`-layout` misaligned this row; confirmed with `pdftotext -raw`) | p.2 "2.8 mm, D:58m O:23m R:11m I:2m" | `41ddcaf3d2cf249f72d629ca5be8c3f774b804b184241f1d4c9093aea670964e` |
| hikvision-ds-2cd2t47g2-l-4mm | DS-2CD2T47G2-L | 4mm | p.2 "4 mm, horizontal FOV 95°" | p.2 (same table) | p.2 (same row) | p.2 "4 mm, D:77m O:30m R:15m I:7m" | (same file as above) |
| hikvision-ds-2cd2t47g2-l-6mm | DS-2CD2T47G2-L | 6mm | p.2 "6 mm, horizontal FOV 58°" | p.2 (same table) | p.2 (same row) | p.2 "6 mm, D:115m O:45m R:23m I:11m" | (same file as above) |
| hikvision-ds-2cd2746g2-izs-2.8-12mm | DS-2CD2746G2-IZS | 2.8-12mm varifocal | p.2 "2.8 to 12 mm, horizontal FOV 108° to 30°" | p.2 "Max. Resolution 2688×1520" | p.2 raw-mode: "IR Range Up to 40 m" (`-layout` misaligned this row) | p.2 Wide "D:64.0m O:25.4m R:12.8m I:6.4m" (Tele "D:190m O:75.4m R:38.0m I:19.0m" recorded in `notes`, not in `manufacturerDoriM`) | `7e8e0689feb3a5145573aca7cdabd16ae83376a1dd7ed9e6aca86d5bce6c1a1c` |

Source URLs:
- DS-2CD2143G2-I: https://assets.hikvision.com/prd/normal/all/doc/sm000058940/DS-2CD2143G2-I_Datasheet_20260525.pdf
- DS-2CD2387G2-LSU/SL: https://www.hikvision.com/content/dam/hikvision/usa/data-sheet/colorvu-ip/Datasheet-for-DS-2CD2387G2-LSU_SL.pdf
- DS-2CD2T47G2-L: https://assets.hikvision.com/prd/public/all/doc/sm000058342/DS-2CD2T47G2-L-C_Datasheet_V5.5.112_20230418.pdf
- DS-2CD2746G2-IZS: https://assets.hikvision.com/prd/public/all/doc/sm000059097/DS-2CD2746G2-IZS-C_Datasheet_V5.5.112_20230217.pdf

Coverage: dome (DS-2CD2143G2-I), turret (DS-2CD2387G2-LSU/SL), bullet (DS-2CD2T47G2-L),
varifocal dome (DS-2CD2746G2-IZS). Gate met (8 records / 4 models >= 4 minimum, target 6).

---

## Dahua (4 models, 7 records)

| Record id | Model | Lens | HFOV source | Max res. source | Illumination source | DORI source | SHA-256 |
|---|---|---|---|---|---|---|---|
| dahua-ipc-hdbw2441e-s-2.8mm | DH-IPC-HDBW2441E-S | 2.8mm | p.2 "Field of View: 2.8 mm: H: 102°; V: 54°; D: 121°" | p.2 "Max. Resolution 2688(H)×1520(V)" | p.2 "Illumination Distance up to 30 m (IR LED)" | p.2 "2.8 mm: 63.6m / 25.4m / 12.7m / 6.4m" | `15679ca651d249e82b364216a7b3b8e2d76bf821aa81a9826986561c2651cb67` |
| dahua-ipc-hdbw2441e-s-3.6mm | DH-IPC-HDBW2441E-S | 3.6mm | p.2 "3.6 mm: H: 84°; V: 42°; D: 101°" | p.2 (same table) | p.2 (same row) | p.2 "3.6 mm: 85.4m / 34.2m / 17.1m / 8.5m" | (same file as above) |
| dahua-ipc-hdw3549h-as-pv-2.8mm | DH-IPC-HDW3549H-AS-PV | 2.8mm | p.2 "Field of View: 2.8 mm: H: 97°; V: 70°; D: 128°" | p.2 "Max. Resolution 2960(H)×1688(V)" | p.2 "Up to 30 m (IR)" + "Up to 30 m (Warm light)" -> `dual` | p.2 "2.8 mm: 66.0m / 26.4m / 13.2m / 6.6m" | `1a590cd9b069651c2d76b78f49c7a52706f585593029574e4837ccb6cf5f93e3` |
| dahua-ipc-hdw3549h-as-pv-3.6mm | DH-IPC-HDW3549H-AS-PV | 3.6mm | p.2 "3.6 mm: H: 78°; V: 58°; D: 102°" | p.2 (same table) | p.2 (same rows) | p.2 "3.6 mm: 78.0m / 22.2m / 15.6m / 7.8m" | (same file as above) |
| dahua-ipc-hfw2441s-s-2.8mm | DH-IPC-HFW2441S-S | 2.8mm | p.2 "Field of View: 2.8mm: H: 95°; V: 52°; D: 114°" | p.2 "Max. Resolution 2688(H)×1520(V)" | p.2 "Illumination Distance 30 m (98.43 ft) (IR LED)" | p.2 "2.8 mm: 63.6m / 25.4m / 12.7m / 6.4m" | `b91cdb0e14f7081e3da15f483b7bf3f147b238ef3632a081caa73eabadecbc4f` |
| dahua-ipc-hfw2441s-s-3.6mm | DH-IPC-HFW2441S-S | 3.6mm | p.2 "3.6mm: H: 78°; V: 41°; D: 94°" | p.2 (same table) | p.2 (same row) | p.2 "3.6 mm: 85.4m / 34.2m / 17.1m / 8.5m" | (same file as above) |
| dahua-ipc-ebw5641-as-1.68mm | DH-IPC-EBW5641-AS | 1.68mm fisheye | p.2 "Field of View: 1.68 mm: H: 185°; V: 185°; D: 185°" | p.2 "Max. Resolution 2560(H)×2560(V)" | p.2 "Built-in IR LED, and the max illumination distance is 15 m" | p.2 "1.68 mm: 33.6m / 13.4m / 6.7m / 3.4m" | `bfb002f5ec015c87b3e7562bfb0e29a1d9f3b249ab701b8976b7409bf56b325b` |

Source URLs:
- DH-IPC-HDBW2441E-S: https://materialfile.dahuasecurity.com/uploads/cpq/prm-os-srv-res/smart/datasheetzipfiles/IPC-HDBW2441E-S_S0_datasheet_20250219.pdf
- DH-IPC-HDW3549H-AS-PV: https://materialfile.dahuasecurity.com/uploads/cpq/prm-os-srv-res/smart/datasheetzipfiles/DH-IPC-HDW3549H-AS-PV_S5_datasheet_20250729.pdf
- DH-IPC-HFW2441S-S: https://materialfile.dahuasecurity.com/uploads/cpq/prm-os-srv-res/smart/datasheetzipfiles/IPC-HFW2441S-S_S0_datasheet_20250218.pdf
- DH-IPC-EBW5641-AS: https://materialfile.dahuasecurity.com/uploads/cpq/88259/datasheet/DH-IPC-EBW5641-AS_datasheet_20260708_English.pdf

Coverage: dome (IPC-HDBW2441E-S), turret/eyeball (IPC-HDW3549H-AS-PV, "eyeball" mapped
to `formFactor: 'turret'`), bullet (IPC-HFW2441S-S), fisheye (IPC-EBW5641-AS, HFOV
185° >= 180° -> arc/fisheye geometry model in phase 3, flagged in `notes`). Gate met
(7 records / 4 models >= 4 minimum, target 6).

**Note on HFOV extraction**: both WizSense datasheets print DORI distances inside the
same spec table used for "Illumination Distance" / frame-rate rows, which caused
`pdftotext -layout` to occasionally misplace a value into the wrong visual column.
Every HFOV and DORI number in this table was cross-checked by locating the literal
`H:`/`V:`/`D:` degree-sign row directly (not inferred from a misaligned column), so
no number here depends on a column alignment guess.

---

## Axis (4 models, 6 records)

| Record id | Model | Lens | HFOV source | Max res. source | Illumination source | SHA-256 |
|---|---|---|---|---|---|---|
| axis-m2035-le-3.2mm | AXIS M2035-LE | 3.2mm | p.2 "AXIS M2035-LE: 3.2 mm, F1.4 ... Horizontal field of view: 101°" | p.2 "Resolution 1920x1080 to 640x360 (16:9)" | p.2 "Outdoor-ready with IR illumination" (built-in IR, no metres published) -> `illuminationRangeM: null` | `f2fe0840dfcdcbac6a6b5114f9540c0d375e2b66bf64871b67f55fbb4542f167` |
| axis-m2035-le-8mm | AXIS M2035-LE 8 mm | 7.5mm (model name says "8mm", printed focal length is 7.5mm) | p.2 "AXIS M2035-LE 8mm: 7.5 mm, F1.6 ... Horizontal field of view: 39°" | p.2 (same resolution table, shared body) | p.2 (same) | (same file as above) |
| axis-m2036-le-2.4mm | AXIS M2036-LE | 2.4mm | p.2 "2.4 mm, F2.1 ... 4 MP (4:3) Horizontal field of view: 109°" | p.2 "Resolution 2304x1728 to 320x240 (4:3)" | p.2 "Outdoor-ready with IR illumination" -> `null` range | `865dbaa741869a9644dc29fdfdb5a3a340d25dfc714affdf2bf0e0fbc736e867` |
| axis-m3098-lv-3.76mm | AXIS M3098-LV | 3.76mm | p.2 "3.76 mm, F2.0, Horizontal field of view: 124°" | p.2 "16:9: 3840x2160 to 640x360" | p.2 "Built-in IR" (no metres published) -> `null` | `af5748cdafe9b4e8f372d0f1a058ed368091b6b1f504c95a29dfe50037199908` |
| axis-p3265-lve-9mm | AXIS P3265-LVE 9 mm | 3.4-8.9mm varifocal | p.2 "9 mm: Varifocal, 3.4-8.9 mm, F1.8, Horizontal field of view: 100°-36°" | p.2 "Resolution 1920x1080 to 160x90" | p.2 "IR illumination / OptimizedIR" (no metres) -> `null` | `513355551df3cf9d27b8baef96af1e97346a7fef9b6073723bffbab8ebdf0e7b` |
| axis-p3265-lve-22mm | AXIS P3265-LVE 22 mm | 9-22mm varifocal | p.2 "22 mm: Varifocal, 9-22 mm, F1.6, Horizontal field of view: 35°-15°" | p.2 (same resolution table) | p.2 (same) | (same file as above) |

Source URLs:
- AXIS M2035-LE: https://www.axis.com/dam/public/2b/84/38/datasheet-axis-m2035-le-bullet-camera-en-US-367672.pdf
- AXIS M2036-LE: https://www.axis.com/dam/public/5d/b6/81/datasheet-axis-m2036-le-bullet-camera-en-US-367671.pdf
- AXIS M3098-LV: https://www.axis.com/dam/public/ce/80/f6/datasheet-axis-m3098-lv-dome-camera-en-US-555319.pdf
- AXIS P3265-LVE: https://www.axis.com/dam/public/a6/e6/1b/datasheet-axis-p3265-lve-dome-camera-en-US-506683.pdf

Coverage: dome/mini-dome (M3098-LV, P3265-LVE), bullet (M2035-LE, M2036-LE), varifocal
(P3265-LVE). No manufacturer-printed DORI exists for any Axis model (confirmed: not
present anywhere in any of the four datasheets). Gate met (6 records / 4 models >= 4
minimum, target 6 reached exactly).

**Uncertain value flagged**: `axis-m2036-le-2.4mm` uses the 4:3 resolution mode
(2304x1728, HFOV 109°) instead of the datasheet's 16:9 mode. The 16:9 pixel width
printed in the PDF text-extracted as `2668x1512` in both `-layout` and `-raw` modes,
which is not an exact 16:9 ratio (2668/1512 = 1.764, not 1.778) - almost certainly a
digit-merging artifact of the PDF's font encoding (likely actually `2688x1512`), but
this environment has no `pdftoppm`/PDF-page-render tool to visually confirm it, so
per the "never guess, never calculate" rule that mode was excluded rather than
corrected from assumption. The 4:3 mode figure is clean in both extraction passes and
was used instead.

---

## Excluded candidates

| Candidate | Brand | Reason excluded |
|---|---|---|
| DS-2CD2347G2-LU-C | Hikvision | PDF link from the hint list returned an S3 `AccessDenied` XML error (not a real PDF). Superseded by DS-2CD2387G2-LSU/SL for turret coverage. |
| DS-2CD2367G2-LU-C | Hikvision | Same S3 `AccessDenied` failure as above on the hinted URL; not re-attempted since turret coverage was already met. |
| DS-2CD2387G2P-LSU/SL (180° dual-lens panoramic) | Hikvision | Not attempted - time-boxed; coverage gate already met via DS-2CD2746G2-IZS (varifocal) without needing a 180° dual-lens model. |
| IPC-HDBW3441E-S-S2, generic Dahua fisheye/panoramic from first research pass | Dahua | Not attempted - superseded once IPC-HFW2441S-S (bullet) and IPC-EBW5641-AS (fisheye) were confirmed from official PDFs, meeting the gate. |
| Axis M4317-PLVE / M3057-PLR Mk II (360°) | Axis | Not attempted - time-boxed; gate already met via P3265-LVE (varifocal) for the "wide/varifocal" coverage slot. |
| Axis P1465-LE (varifocal bullet) | Axis | Not attempted - P3265-LVE already supplied the varifocal/wide-or-varifocal coverage requirement for Axis. |

No model was excluded *because* it lacked HFOV or pixel data in this pass - the two
Hikvision drops above failed at download (not a real PDF), everything else in the
"excluded" table was simply not attempted once each brand's gate (>= 4 records,
dome/turret + bullet + wide-or-varifocal) was already satisfied by other models.

---

## 140-179° HFOV flag check

No shipped record has a fixed-lens or varifocal-endpoint HFOV in the 140-179°
range (rectilinear cone math is unreliable there per the phase architecture note).
Widest fixed HFOV shipped: 130° is not present either - highest fixed is
`axis-m2036-le` at 109° (4:3 mode) and `hikvision-ds-2cd2t47g2-l-2.8mm` at 112°; the
only value >= 180° is the Dahua fisheye at 185°, which uses the arc/fisheye geometry
model instead of the rectilinear cone, so it is not in the warning band either. This
is verified by an automated test in `src/catalog/camera-catalog-loader.test.ts`.

---

## Addendum 2026-10-05: Vietnam-market models + indicative VN prices

Catalog is now 47 records (Hikvision 16, Dahua 16, Axis 15). New models were chosen
because Vietnamese resellers list them; optical specs still come only from the official
datasheet (same curl + `pdftotext -raw` method, every HFOV / max-resolution / illumination /
DORI line below re-read from the downloaded PDF).

### New models (datasheet = record `sourceUrl`)

| Brand | Model | Records (lens -> HFOV) | Max res. | Illumination | DORI printed |
|---|---|---|---|---|---|
| Hikvision | DS-2CD1023G2-LIU(F) bullet | 2.8mm -> 103°, 4mm -> 83° | 1920×1080 | IR + white light, up to 30 m | 45/18/9/4, 56/22/11/5 |
| Hikvision | DS-2CD1323G2-LIU turret | 2.8mm -> 103°, 4mm -> 83° | 1920×1080 | IR + white light, up to 30 m | 45/18/9/4, 56/22/11/5 |
| Hikvision | DS-2CD1043G2-LIU(F) bullet | 2.8mm -> 98°, 4mm -> 78° | 2560×1440 | IR + white light, up to 30 m | 63/25/12/6, 78/31/15/7 |
| Hikvision | DS-2CD1343G2-LIU turret | 2.8mm -> 98°, 4mm -> 78° | 2560×1440 | IR + white light, up to 30 m | 63/25/12/6, 78/31/15/7 |
| Dahua | DH-IPC-HFW1430DT-STW bullet (Wi-Fi) | 2.8mm -> 90°, 3.6mm -> 76° | 2560×1440 | IR 30 m | 68.0/27.2/13.6/6.8, 85.2/34.1/17.0/8.5 |
| Dahua | DH-IPC-HFW1230S-S5 bullet | 2.8mm -> 102°, 3.6mm -> 84° | 1920×1080 | IR 30 m | 38.6/15.4/7.7/3.9, 49.7/19.9/9.9/5.0 |
| Dahua | DH-IPC-HFW2249S-S-IL bullet | 2.8mm -> 107°, 3.6mm -> 88° | 1920×1080 | IR 30 m + warm light 30 m | 43.9/17.5/8.8/4.4, 58.9/23.6/11.8/5.9 |
| Dahua | DH-IPC-HFW2441T-ZS bullet | 2.7-13.5mm -> 104°-29° | 2688×1520 | IR 60 m | wide 64.0/25.6/12.8/6.4 (tele 210/84/42/21 not stored) |
| Dahua | DH-IPC-HDBW1430DE-SW dome (Wi-Fi) | 2.8mm -> 90°, 3.6mm -> 76° | 2560×1440 | IR 30 m | 68/27.2/13.6/6.8, 85.2/34.1/17.0/8.5 |
| Axis | M3085-V mini dome | 3.1mm -> 102° | 1920×1080 | none (no built-in IR) | - |
| Axis | M3086-V mini dome | 2.4mm -> 130° | 2688×1512 | none | - |
| Axis | M3088-V mini dome | 2.9mm -> 109° | 3840×2160 | none | - |
| Axis | P1465-LE bullet | 3-9mm -> 117°-37°, 10.9-29mm -> 29°-11° | 1920×1080 | IR reach 40 m (9 mm) / 80 m (29 mm) | - |
| Axis | P1467-LE bullet | 2.8-8mm -> 106°-38° | 2592×1944 | IR reach 40 m | - |
| Axis | P1468-LE bullet | 6.2-12.9mm -> 108°-49° | 3840×2160 | IR reach 40 m | - |
| Axis | P3287-LVE dome | 3.0-8.5mm -> 104°-34° | 2592×1944 (4:3) | IR reach 40 m | wide 60/24/12/6 (tele 170/67/34/17 not stored) |
| Axis | M4317-PLVE fisheye | 1.1mm -> 182° | 2160×2160 overview ("6 MP") | IR reach 20 m | - |

### `priceVn` (indicative, not a datasheet value)

Read from the reseller page stored in each record's `priceVn.sourceUrl` on 2026-10-05:
the displayed selling price (not the struck-through list price), whole VND. `null` = no
Vietnamese page showed a number for that exact model ("Liên hệ" / "Vui lòng gọi" / not listed).
Never converted from a foreign-currency price by us.

- Hikvision 11/16 priced: hacom.vn (DS-2CD1023G2, DS-2CD1323G2), vuhoangtelecom.vn
  (DS-2CD1043G2, DS-2CD1343G2), panaco.vn (DS-2CD2T47G2-L). The 1023/1323/1043 prices are
  the shops' `-LIUF` (built-in mic) listing - flagged in each record's `notes`.
  No price: DS-2CD2143G2-I (VN shops stock only `-IU`), DS-2CD2387G2-LSU/SL, DS-2CD2746G2-IZS.
- Dahua 11/16 priced: hacom.vn, vuhoangtelecom.vn. No price: HDW3549H-AS-PV, EBW5641-AS,
  HDBW1430DE-SW.
- Axis 5/15 priced, all from fado.vn - a cross-border marketplace reselling Amazon US
  listings at a landed VND price, not an authorised Vietnam distributor (flagged in `notes`).
  Axis distributors in Vietnam quote on request, so the rest are `null`.
