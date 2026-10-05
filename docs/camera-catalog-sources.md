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

Catalog was then 47 records (Hikvision 16, Dahua 16, Axis 15); 51 after the `-LIUF` records
added below. New models were chosen
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

- Hikvision 15/20 priced: hacom.vn (DS-2CD1023G2-LIUF, DS-2CD1323G2), vuhoangtelecom.vn
  (DS-2CD1043G2-LIUF, DS-2CD1343G2), panaco.vn (DS-2CD2T47G2-L). The 1023 / 1323 / 1043 prices
  are the shops' `-LIUF` listings. By owner decision the plain `-LIU` records carry that same
  price (flagged in their `notes`); it is not a price read for the exact `-LIU` model.
  No price: DS-2CD2143G2-I (VN shops stock only `-IU`), DS-2CD2387G2-LSU/SL, DS-2CD2746G2-IZS.
- Dahua 11/16 priced: hacom.vn, vuhoangtelecom.vn. No price: HDW3549H-AS-PV, EBW5641-AS,
  HDBW1430DE-SW.
- Axis 5/15 priced, all from fado.vn - a cross-border marketplace reselling Amazon US
  listings at a landed VND price, not an authorised Vietnam distributor (flagged in `notes`).
  Axis distributors in Vietnam quote on request, so the rest are `null`.

## Addendum 2026-10-05: protection rating, audio, built-in detection

Seven fields per record (`ingressRatings`, `ikRating`, `hasBuiltInMic`, `hasBuiltInSpeaker`,
`hasAudioInPort`, `hasAudioOutPort`, `detectionTypes`), read on 2026-10-05 from the PDF at each
record's own `sourceUrl`. Method: `curl -A "Mozilla/5.0" -L` -> `%PDF` header check ->
`sha256sum` -> `pdftotext -layout`, cross-checked with `pdftotext -raw` (layout mode shifts
table rows against their labels) -> values copied as printed. All 29 unique PDFs downloaded;
the 12 with a SHA-256 earlier in this document matched it exactly, the other 17 are hashed here
for the first time. Six PDFs (two per brand) were downloaded a second time and re-checked
against the tables below: same hashes, quotes found.

### Field rules

- Two-state, not tri-state. `true` / a listed value = the datasheet prints it for this exact
  model string. `false` / `null` / `[]` = not printed as present. That is not a confirmed
  absence, so the app says "not listed", never "no".
- Exact model. A value the datasheet prints only for a suffix variant ("-S:", "Only -ZAS
  supports", a per-lens row) applies only to a record whose `model` satisfies that condition.
- Ingress: every printed IP code, printed order; "IP66/IP67" is stored as `["IP66","IP67"]`.
  NEMA is not stored. A rating printed as optional or accessory-dependent is not stored.
- Audio: on-device hardware only. A built-in mic/speaker must be printed as built-in; ports
  are physical connectors. Network speaker pairing, portcast and optional accessories do not
  count.
- Detection: the printed target class of an on-device function, never a technology name alone
  (AcuSense, WizSense, SMD, AXIS Object Analytics).

| Stored | Printed wording that maps to it |
|---|---|
| `human` | human, person, people, pedestrian, humanoid, body (as a detected/classified target) |
| `vehicle` | vehicle, motor vehicle, car (as a detected/classified target) |
| `face` | face detection, face capture, face recognition (a named function; a metadata class line alone does not count) |
| `license-plate` | license plate(s) as a detected object class |

  Not mapped: plain motion detection, line crossing / intrusion with no class filter,
  people counting with no "human" wording, object attributes, optional paid apps.
- The "Outdoor (IP65+)" sidebar filter is computed in the app from `ingressRatings` (dust
  digit 6, water digit 5 or higher). It is not a catalog value.

### Hikvision (8 PDFs, 20 records)

| Model | record ids | SHA-256 | hash status | IP/IK: page + quote | Audio: page + quote | Detection: page + quote |
|---|---|---|---|---|---|---|
| DS-2CD2143G2-I | hikvision-ds-2cd2143g2-i-2.8mm, hikvision-ds-2cd2143g2-i-4mm | `b83491f396a0bb86b01a56eb1c5e6f0dde584e39cb9dfec802df72748ca6097c` | match (sources doc) | p.1 "Water and dust resistant (IP67) and vandal resistant (IK10)"; p.4 "IP67 (IEC 60529-2013), IK10 (IEC 62262: 2002)" -> `["IP67"]` / `"IK10"` | p.3 "Audi o -S: 1 input (line in) ... 1 output (line out)" - conditioned on "-S" suffix; record model is plain "DS-2CD2143G2-I" (no S) so condition not satisfied -> all 4 audio flags `false`; no "microphone"/"speaker" word anywhere in the PDF | p.3 "Motion detection (human and vehicle targets classification)"; p.3 "intrusion detection (support alarm triggering by specified target types (human and vehicle))"; p.3 "Face detection" (General Function) -> `["human","vehicle","face"]` |
| DS-2CD2387G2-LSU/SL | hikvision-ds-2cd2387g2-lsu-sl-2.8mm, hikvision-ds-2cd2387g2-lsu-sl-4mm | `cc48a9d8f69b0586c689879bb299bdd74a35eaa0ced2baa7ddacb4f3b78190fd` | match (sources doc) | p.1 "Water and dust resistant (IP67)"; p.4 "Protection IP67: IEC 60529-2013"; no "IK"/"vandal" anywhere -> `["IP67"]` / `null` | p.3 "Built-in Microphone Yes"; p.3 "Built-in Speaker 1.5 W, 10 cm: 95 dB"; p.3 "1 input (line in), max. input amplitude: 3.3 Vpp..."; p.3 "1 output (line out), max.output amplitude: 3.3 Vpp..." -> all 4 `true` | p.3 "Motion detection (support alarm triggering by specified target types (human and vehicle))"; p.3 "intrusion detection ... (support alarm triggering by specified target types (human and vehicle))"; p.4 "Face Capture Yes" -> `["human","vehicle","face"]` |
| DS-2CD2T47G2-L | hikvision-ds-2cd2t47g2-l-2.8mm, hikvision-ds-2cd2t47g2-l-4mm, hikvision-ds-2cd2t47g2-l-6mm | `41ddcaf3d2cf249f72d629ca5be8c3f774b804b184241f1d4c9093aea670964e` | match (sources doc) | p.1 "Water and dust resistant (IP67)"; p.4 "Protection IP67 (IEC 60529-2013)"; no "IK"/"vandal" anywhere -> `["IP67"]` / `null` | no "microphone"/"speaker"/"line in"/"line out"/"audio in"/"audio out" anywhere in the PDF -> all 4 `false` | p.3 "Motion detection (human and vehicle targets classification)"; p.3 "Face Capture Yes"; p.3 "Perimeter Protection: Line crossing detection, intrusion detection, region entrance detection, region exiting detection" (no class filter printed for this row - not mapped) -> `["human","vehicle","face"]` |
| DS-2CD2746G2-IZS | hikvision-ds-2cd2746g2-izs-2.8-12mm | `7e8e0689feb3a5145573aca7cdabd16ae83376a1dd7ed9e6aca86d5bce6c1a1c` | match (sources doc) | p.1 "Water and dust resistant (IP66) and vandal-resistant (IK10)"; p.4 "Protection IP66 (IEC 60529-2013), IK10(IEC 62262:2002)" -> `["IP66"]` / `"IK10"` | p.3 "1 input (line in), 3.5 mm connector..."; p.3 "1 output (line out), 3.5 mm connector..." -> in/out `true`; no "microphone"/"speaker" word anywhere -> mic/speaker `false` | p.3 "Motion detection (human and vehicle targets classification)"; p.4 "Face Capture Yes"; p.4 "Perimeter Protection: Line crossing detection, intrusion detection, region entrance detection, region exiting detection" (no class filter - not mapped) -> `["human","vehicle","face"]` |
| DS-2CD1023G2-LIU(F) | hikvision-ds-2cd1023g2-liu-2.8mm, hikvision-ds-2cd1023g2-liu-4mm, hikvision-ds-2cd1023g2-liuf-2.8mm, hikvision-ds-2cd1023g2-liuf-4mm | `48889c720c850b5f02ffcaeffae7a709fea68c0e4ed0ebe47b5e8fb508f02526` | new hash (addendum, no prior entry) | p.1 "Water and dust resistant (IP67)"; p.4 "Protection IP67: IEC 60529-2013"; no "IK"/"vandal" anywhere -> `["IP67"]` / `null` | p.1 "Built-in microphone for real-time audio security" (unconditioned, applies to whole "DS-2CD1023G2-LIU(F)" family); p.3 "Built-in Microphone Yes" (no "-F:" prefix, unlike the "-F: Built-in memory card slot..." and "Reset Key -F: Yes" rows right next to it) -> mic `true`; no "speaker"/"line in"/"line out" word anywhere -> speaker/in/out `false` | p.1 "Support Human and Vehicle Detection"; p.3 "Motion detection (support alarm triggering by specified target types (human and vehicle))"; no "face" word anywhere -> `["human","vehicle"]` |
| DS-2CD1323G2-LIU | hikvision-ds-2cd1323g2-liu-2.8mm, hikvision-ds-2cd1323g2-liu-4mm | `ba2525e89d336973ef44082b263111c4cc77ad28a8dc5f325929dba3047e3b6f` | new hash (addendum) | p.1 "Water and dust resistant (IP67)"; p.4 "Protection IP67: IEC 60529-2013"; no "IK"/"vandal" anywhere -> `["IP67"]` / `null` | p.1 "Built-in microphone for real-time audio security"; p.3 "Built-in Microphone Yes" (unconditioned; "-F:" prefix used elsewhere for Profile G / Reset Key only) -> mic `true`; no "speaker"/"line in"/"line out" anywhere -> speaker/in/out `false` | p.1 "Support Human and Vehicle Detection"; p.3 "Motion detection (support alarm triggering by specified target types (human and vehicle))"; no "face" word anywhere -> `["human","vehicle"]` |
| DS-2CD1043G2-LIU(F) | hikvision-ds-2cd1043g2-liu-2.8mm, hikvision-ds-2cd1043g2-liu-4mm, hikvision-ds-2cd1043g2-liuf-2.8mm, hikvision-ds-2cd1043g2-liuf-4mm | `4b26acd06ad50a702bb7cf8d93ff4230221261877ba3464f3591a093a986a9e6` | new hash (addendum) | p.1 "Water and dust resistant (IP67)"; p.4 "Protection IP67: IEC 60529-2013"; no "IK"/"vandal" anywhere -> `["IP67"]` / `null` | p.1 "Built-in microphone for real-time audio security"; p.3 "Built-in Microphone Yes" (unconditioned, same "-F:" pattern as the 1023G2 sheet) -> mic `true`; no "speaker"/"line in"/"line out" anywhere -> speaker/in/out `false` | p.1 "Support Human and Vehicle Detection"; p.3 "Motion detection (support alarm triggering by specified target types (human and vehicle))"; no "face" word anywhere -> `["human","vehicle"]` |
| DS-2CD1343G2-LIU | hikvision-ds-2cd1343g2-liu-2.8mm, hikvision-ds-2cd1343g2-liu-4mm | `eb0e53cb99b06dc6ecf59c4f0dc5a31ee193aa451e1168d45afaf262a7da50a9` | new hash (addendum) | p.1 "Water and dust resistant (IP67)"; p.4 "Protection IP67: IEC 60529-2013"; no "IK"/"vandal" anywhere -> `["IP67"]` / `null` | p.1 "Built-in microphone for real-time audio security"; p.3 "Built-in Microphone Yes" (unconditioned) -> mic `true`; no "speaker"/"line in"/"line out" anywhere -> speaker/in/out `false` | p.1 "Support Human and Vehicle Detection"; p.3 "Motion detection (support alarm triggering by specified target types (human and vehicle))"; no "face" word anywhere -> `["human","vehicle"]` |

### Dahua (9 PDFs, 16 records)

| Model | Record ids | SHA-256 | Hash status | IP/IK: page + quote | Audio: page + quote | Detection: page + quote |
|---|---|---|---|---|---|---|
| DH-IPC-HDBW2441E-S | dahua-ipc-hdbw2441e-s-2.8mm, dahua-ipc-hdbw2441e-s-3.6mm | `15679ca651d249e82b364216a7b3b8e2d76bf821aa81a9826986561c2651cb67` | match (sources.md) | p.3 "Protection ... IP67; IK10" (also p.1 "IP67, IK10 protection.") | p.2 "Built-in MIC Yes" (raw); no Audio Input/Output row, no Built-in Speaker row anywhere in doc | p.2 "Intrusion, tripwire (the two functions support the classification and accurate detection of vehicle and human)" |
| DH-IPC-HDW3549H-AS-PV | dahua-ipc-hdw3549h-as-pv-2.8mm, dahua-ipc-hdw3549h-as-pv-3.6mm | `1a590cd9b069651c2d76b78f49c7a52706f585593029574e4837ccb6cf5f93e3` | match (sources.md) | p.3 "Protection IP67" (no IK code printed anywhere in doc) | p.2 "Built-in MIC Yes"; p.2 "Built-in Speaker / Yes / Max power consumption: 2 W; max sound level at 10 cm: 110 dB"; p.3 "Audio Input 1 channel (RCA port)"; p.3 "Audio Output 1 channel (RCA port)" | p.2 "...classification and accurate detection of vehicle and human), stay detection, loitering detection"; p.2 "Face Detection (Full ... Face detection; snapshot; ... face snapshot upload; ..." |
| IPC-HFW2441S-S | dahua-ipc-hfw2441s-s-2.8mm, dahua-ipc-hfw2441s-s-3.6mm | `b91cdb0e14f7081e3da15f483b7bf3f147b238ef3632a081caa73eabadecbc4f` | match (sources.md) | p.3 "Protection IP67" (no IK code printed) | "Built-in MIC Yes"; no Audio Input/Output, no Built-in Speaker row anywhere | "Intrusion, tripwire ... classification and accurate detection of vehicle and human)" |
| DH-IPC-EBW5641-AS | dahua-ipc-ebw5641-as-1.68mm | `bfb002f5ec015c87b3e7562bfb0e29a1d9f3b249ab701b8976b7409bf56b325b` | match (sources.md) | p.3 "Protection IP67; IK10" (also p.1 "IP67 and IK10 protection.") | p.3 "Built-in MIC Yes, built-in dual Mic"; p.3 "Built-in Speaker Yes, built-in speaker"; p.3 "Audio Input 1 channel (RCA port)"; p.3 "Audio Output 1 channel (RCA port)" | "IVS (Perimeter Protection) / Tripwire, intrusion (the two functions support accurate detection of human)" - no vehicle/face word anywhere in doc |
| IPC-HFW1430DT-STW | dahua-ipc-hfw1430dt-stw-2.8mm, dahua-ipc-hfw1430dt-stw-3.6mm | `000585487d67ae0f1bce916e2e6243e9bbc418dfb90f8a8b0ddf4ef8f2f4bc33` | new hash (not in sources.md) | p.3 "Protection IP67" (no IK code printed) | p.2 "Built-in MIC Yes"; p.2 "Built-in Speaker Yes"; no Audio Input/Output RCA port row anywhere (two-way audio is via mobile app, not a physical port) | not printed - no human/vehicle/face/classif word anywhere in doc |
| IPC-HFW1230S-S5 | dahua-ipc-hfw1230s-s5-2.8mm, dahua-ipc-hfw1230s-s5-3.6mm | `73604b69e98f74c8215b70eeecacf7a48928a8c9c5287075a0f5efd61bcde289` | new hash (not in sources.md) | p.3 "Protection IP67" (no IK code printed) | not printed - no Audio/mic/speaker section anywhere in doc | not printed - no human/vehicle/face/classif word anywhere in doc |
| IPC-HFW2249S-S-IL | dahua-ipc-hfw2249s-s-il-2.8mm, dahua-ipc-hfw2249s-s-il-3.6mm | `27b462cdd6745032f61cd6891a303b2d1ecafb407877195c52b0afb6afa7e6fc` | new hash (not in sources.md) | p.3 "Protection IP67" (no IK code printed) | p.2 "Built-in MIC Yes"; no Audio Input/Output, no Built-in Speaker row anywhere | p.2 "classification and accurate detection of vehicle and human)" |
| IPC-HFW2441T-ZS | dahua-ipc-hfw2441t-zs-2.7-13.5mm | `37aa36632f5e59eb558e2b7221b62a452538a7ae4743cf74c238245c2bdd1546` | new hash (not in sources.md) | p.3 "Protection IP67, IK10 (optional)" - see Ambiguous | p.2 "Built-in MIC Yes"; p.3 "Audio Input 1 channel (RCA port) (Only - ZAS supports)"; p.3 "Audio Output 1 channel (RCA port) (Only - ZAS supports)" - see decision below; no Built-in Speaker row | p.2 "classification and accurate detection of vehicle and human)" |
| IPC-HDBW1430DE-SW | dahua-ipc-hdbw1430de-sw-2.8mm, dahua-ipc-hdbw1430de-sw-3.6mm | `8c50b744625353e234ca37f80fd3056fb869edba9b32fd97c9e637956c3365d6` | new hash (not in sources.md) | p.3 "Protection IP67; IK10" (also p.1 "IP67, IK10 protection.") | not printed - no Audio/mic/speaker section anywhere in doc | not printed - no human/vehicle/face/classif word anywhere in doc |

### Axis (12 PDFs, 15 records)

| Model | Record ids | SHA-256 | Hash status | IP/IK: page + quote | Audio: page + quote | Detection: page + quote |
|---|---|---|---|---|---|---|
| AXIS M2035-LE | axis-m2035-le-3.2mm, axis-m2035-le-8mm | `f2fe0840dfcdcbac6a6b5114f9540c0d375e2b66bf64871b67f55fbb4542f167` | match (docs) | p.2/4 "IEC 60068-2-X, IEC/EN 60529 IP66/IP67, IEC/EN 62262 IK08"; p.2 "IP66-/IP67-, NEMA 4X- and IK08-rated" -> `["IP66","IP67"]`, `"IK08"` | p.2 "Audio Smart pairing with Axis speakers via edge-to-edge technology"; "Audio output" row printed with no connector value -> network-paired speaker, not built-in/physical port -> all 4 audio flags `false` | p.1 "AXIS Object Analytics offers detection and classification of humans, vehicles, and types of vehicles"; p.2 "Object classes: humans, vehicles (types: cars, buses, trucks," -> `["human","vehicle"]` |
| AXIS M2036-LE | axis-m2036-le-2.4mm | `865dbaa741869a9644dc29fdfdb5a3a340d25dfc714affdf2bf0e0fbc736e867` | match (docs) | p.2 "IEC 60068-2-X, IEC/EN 60529 IP66/IP67, IEC/EN 62262 IK08"; p.2 "IP66-/IP67-, NEMA 4X- and IK08-rated" -> `["IP66","IP67"]`, `"IK08"` | p.2 "Audio Smart pairing with Axis speakers via edge-to-edge technology"; blank "Audio output" row -> all 4 flags `false` | p.1 "offers detection and classification of humans, vehicles, and types of vehicles"; p.2 "Object classes: humans, vehicles (types: cars, buses, trucks," -> `["human","vehicle"]` |
| AXIS M3098-LV | axis-m3098-lv-3.76mm | `af5748cdafe9b4e8f372d0f1a058ed368091b6b1f504c95a29dfe50037199908` | match (docs) | p.4 "IEC/EN 60529 IP42, IEC/EN 62262 IK08"; p.2 "IP42- and IK08-rated" -> `["IP42"]`, `"IK08"` | Connectors section: "Connectors / Network: RJ45 ... / Sensor / Acoustic sensor" - no Audio row, no "microphone"/"speaker" word anywhere in doc (only regulatory "MIC(4)" mark) -> all 4 flags `false` | p.3 AXIS Object Analytics "Object classes: humans, vehicles (types: cars, buses, trucks, bikes, other)"; p.3 AXIS Scene Metadata (listed under "Included" apps) "Object data: Classes: humans, faces, vehicles (types: cars, buses, trucks, bikes), license plates" -> `["human","vehicle","license-plate"]` (`face` not stored, see Owner decisions) |
| AXIS P3265-LVE 9 mm | axis-p3265-lve-9mm | `513355551df3cf9d27b8baef96af1e97346a7fef9b6073723bffbab8ebdf0e7b` | match (docs) | p.4 "IEC/EN 60529 IP66, IEC/EN 62262 IK10, NEMA 250"; p.4 "IP66-, NEMA 4X- and IK10-rated" -> `["IP66"]`, `"IK10"` | p.2 "Audio input/output / 9 mm: External microphone input, line input, digital input with ring power, line output, automatic gain control"; p.5 connectors "9 mm: 4-pin 2.5 mm terminal block for audio in and out" -> external mic (not built-in) so `hasBuiltInMic=false`; line in + line out physically present -> `hasAudioInPort=true`, `hasAudioOutPort=true`; no speaker wording -> `hasBuiltInSpeaker=false` | p.3 AXIS Object Analytics "Object classes: humans, vehicles (types: cars, buses,"; p.3 AXIS Scene Metadata "Object data: Classes: humans, faces, vehicles (types:" (Included apps list confirms on-device) -> `["human","vehicle","license-plate"]` (`face` not stored, see Owner decisions) |
| AXIS P3265-LVE 22 mm | axis-p3265-lve-22mm | `513355551df3cf9d27b8baef96af1e97346a7fef9b6073723bffbab8ebdf0e7b` | match (docs), same PDF as 9mm | same as 9mm row -> `["IP66"]`, `"IK10"` | p.2 "22 mm: External microphone input, line input, digital input with ring power, automatic gain control, network speaker pairing"; p.5 connectors "22 mm: 3.5 mm mic/line in" (no out connector for this variant) -> `hasAudioInPort=true`, `hasAudioOutPort=false` (only network speaker pairing, not physical out), `hasBuiltInMic=false`, `hasBuiltInSpeaker=false` | same datasheet, same analytics section -> `["human","vehicle","license-plate"]` (`face` not stored, see Owner decisions) |
| AXIS M3085-V | axis-m3085-v-3.1mm | `42a2c7f7c549ba64c3aa697865364f7af99d13aa261be3c9780605150682cce9` | new hash (not in docs) | p.2 "IP42 water- and dust-resistant (to comply with IP42, follow Installation Guide), IK08 impact-resistant"; p.4 "IEC/EN 60529 IP42, IEC/EN 62262 Class IK08" -> `["IP42"]`, `"IK08"` | p.2 "Audio Two-way audio connectivity via optional accessories using portcast technology"; blank "Audio input/output" row -> optional accessory + portcast = all 4 flags `false` | p.2 "Object classes: humans, vehicles (types: cars, buses, trucks, bikes)" -> `["human","vehicle"]` |
| AXIS M3086-V | axis-m3086-v-2.4mm | `54dba946bf08138ca0e2f20193396594d2d26f09f4136259f204c7eb3bb3eff2` | new hash (not in docs) | p.2 "IP42 water- and dust-resistant (to comply with IP42, follow Installation Guide), IK08 impact-resistant"; p.4 "IEC/EN 60529 IP42, IEC/EN 62262 Class IK08" -> `["IP42"]`, `"IK08"` | p.2 "Audio Two-way audio connectivity via optional accessories using portcast technology" -> all 4 flags `false` | p.2 "Object classes: humans, vehicles (types: cars, buses, trucks," -> `["human","vehicle"]` |
| AXIS M3088-V | axis-m3088-v-2.9mm | `55b218540b1ff848b929d4f120c449af82823d53255737c91d52da9baeb0b449` | new hash (not in docs) | p.4 "IEC 60068-2-27, IEC/EN 60529 IP42, IEC/EN 62262 Class IK08"; p.3 "IP42 water- and dust-resistant (to comply with IP42, follow Installation Guide), IK08 impact-resistant" -> `["IP42"]`, `"IK08"` | p.2 "Audio Two-way audio connectivity via optional accessories using portcast technology" -> all 4 flags `false` | p.2 "AXIS Object Analytics / Object classes: humans, vehicles (types: cars, buses, trucks, bikes)"; p.2 "Metadata / Object data: Classes: humans, faces, vehicles (types: cars, buses, trucks, bikes), license plates" -> `["human","vehicle"]` (`face` not stored, see Owner decisions) (see Ambiguous) |
| AXIS P1465-LE 9 mm | axis-p1465-le-9mm | `a5303f4a48ab392b1b62607afa5e8176159605efe0d35c39bdc925388e5675ce` | new hash (not in docs) | p.4 "IEC/EN 60529 IP66/IP67, IEC/EN 62262 IK10, NEMA 250 Type 4X"; p.1 "this IP66/IP67, NEMA 4X, and IK10-rated camera" -> `["IP66","IP67"]`, `"IK10"` | p.3 "Audio input / Input for external unbalanced microphone, optional 5 V microphone power" + "Unbalanced line input"; p.3 "Audio output / Output via network speaker pairing"; connectors p.4 "Audio: 3.5 mm mic/line in" (input only, no out connector) -> `hasAudioInPort=true`, `hasBuiltInMic=false` (external mic only), `hasAudioOutPort=false`, `hasBuiltInSpeaker=false` (network pairing only) | p.3 AXIS Object Analytics "Object classes: humans, vehicles (types: cars, buses, trucks, bikes, other)"; p.3 AXIS Scene Metadata (in "Included" apps list) "Object classes: humans, faces, vehicles (types: cars, buses, trucks, bikes), license plates" -> `["human","vehicle","license-plate"]` (`face` not stored, see Owner decisions) |
| AXIS P1465-LE 29 mm | axis-p1465-le-29mm | `a5303f4a48ab392b1b62607afa5e8176159605efe0d35c39bdc925388e5675ce` | new hash, same PDF as 9mm | same as 9mm row -> `["IP66","IP67"]`, `"IK10"` | same shared-body spec -> `hasAudioInPort=true`, others `false` | same analytics section -> `["human","vehicle","license-plate"]` (`face` not stored, see Owner decisions) |
| AXIS P1467-LE | axis-p1467-le-8mm | `9bfd5ff6b3cf97d85c53b0540bfae39d8358f2a8bf754c38b220ef3fd709324b` | new hash (not in docs) | p.4 "IEC/EN 60529 IP66/IP67, IEC/EN 62262 IK10"; p.1 "This IP66/IP67, NEMA 4X, and IK10-rated camera" -> `["IP66","IP67"]`, `"IK10"` | p.2 "Audio input/output / External microphone input or line input, digital audio input, ring power, network speaker pairing"; connectors p.4 "3.5 mm mic/line in" + separate "Terminal block for 1 supervised alarm input and 1 output (12 V DC output ...)" (that output is the alarm relay, not audio) -> `hasAudioInPort=true`, `hasBuiltInMic=false`, `hasAudioOutPort=false`, `hasBuiltInSpeaker=false` | p.2 "Applications Included / AXIS Object Analytics, AXIS Scene Metadata, AXIS Image Health Analytics"; p.2 "Object classes: humans, vehicles (types: cars, buses, trucks, bikes, other)"; p.2 "Object classes: humans, faces, vehicles (types: cars, buses, trucks, bikes), license plates" -> `["human","vehicle","license-plate"]` (`face` not stored, see Owner decisions) |
| AXIS P1468-LE | axis-p1468-le-12.9mm | `92f8f1387d2525da2c3c91644958c54956242a9dac5803694f91367d608a36b4` | new hash (not in docs) | p.4 "IEC/EN 60529 IP66/IP67, IEC/EN 62262 IK10"; p.1 "This IP66/IP67, NEMA 4X, and IK10-rated camera" -> `["IP66","IP67"]`, `"IK10"` | p.2 "Audio input/output / External microphone input or line input, digital audio input, ring power, network speaker pairing"; connectors p.4 "3.5 mm mic/line in" + separate alarm-relay output -> `hasAudioInPort=true`, `hasBuiltInMic=false`, `hasAudioOutPort=false`, `hasBuiltInSpeaker=false` | p.2 "Applications Included / AXIS Object Analytics, AXIS Scene Metadata, AXIS Image Health Analytics"; "Object classes: humans, vehicles (types: cars, buses,"; "Object classes: humans, faces, vehicles (types: cars," -> `["human","vehicle","license-plate"]` (`face` not stored, see Owner decisions) |
| AXIS P3287-LVE | axis-p3287-lve-8.5mm | `da45052397f4eea2889bdbd9230c8568f509b74253d38eb898d173a26baf75ee` | new hash (not in docs) | p.4 "IEC/EN 60529 IP66, IEC/EN 62262 IK10, NEMA 250"; p.1 "This robust, IK10-, IP66-, and NEMA 4X-rated outdoor-ready camera" -> `["IP66"]`, `"IK10"` | Connectors p.5: "Network: RJ45 ...", "I/O: 4-pin 2.5 mm terminal block for 1 alarm input and 1 output", "Sensor / Acoustic sensor" - no Audio row, no "microphone"/"speaker" word anywhere -> all 4 flags `false` | p.3 "Applications Included / AXIS Object Analytics, AXIS Image Health Analytics, AXIS Audio Analytics, AXIS Scene Metadata, AXIS Live Privacy Shield, AXIS Video Motion Detection"; "Object classes: humans, vehicles (types: cars, buses, trucks, bikes, other)"; "AXIS Scene Metadata / Object classes: humans, faces, vehicles (types: cars, buses, trucks, bikes), license plates" -> `["human","vehicle","license-plate"]` (`face` not stored, see Owner decisions) |
| AXIS M4317-PLVE | axis-m4317-plve-1.1mm | `302a4eea32f2e2a0378a735a1c9e021c3b1eaac446924adac0e13d7546d7d2ce` | new hash (not in docs) | p.4 "IEC/EN 60529 IP66, ISO 4892-2, NEMA 250 Type 4X"; "IEC/EN 62262 IK10"; p.3 "IP66-, NEMA 4X- and IK10-rated" -> `["IP66"]`, `"IK10"` | p.2 "Audio features / Network speaker pairing"; p.2 "Audio / Audio features through portcast technology: two-way audio"; connectors p.4 "Audio: Audio and I/O connectivity via portcast technology" -> all network/portcast, not physical/built-in -> all 4 flags `false` | p.2 "Applications Included / AXIS Object Analytics, AXIS Scene Metadata, AXIS Video Motion Detection"; "AXIS Object Analytics / Object classes: humans, vehicles (types: cars, buses, trucks, bikes)"; "AXIS Scene [Metadata] / Object classes: humans, faces, vehicles (types: cars, buses, trucks, bikes)" -> `["human","vehicle"]` (`face` not stored, see Owner decisions) |

### Judgment calls

- Hikvision `-LIU` records (DS-2CD1023G2, DS-2CD1043G2 on a `-LIUF` datasheet; DS-2CD1323G2,
  DS-2CD1343G2 on their own `-LIU` sheet, same wording): the 1023G2 / 1043G2 sheets are
  titled `...-LIU(F)`, the 1023G2 sheet lists both `-LIU` and `-LIUF` under "Available Model",
  and "Built-in Microphone Yes" is printed with no "-F:" marker although the neighbouring
  rows (memory card slot, reset key, Profile G) carry one. The mic is therefore stored as
  `true` for `-LIU`. This contradicts the "-LIUF (built-in mic)" wording in those records'
  earlier `notes`, which came from reseller
  listings, not the datasheet (all six notes were reworded, see Owner decisions).
- Axis M3085-V, M3086-V, M3088-V: IP42 is printed with "to comply with IP42, follow
  Installation Guide". That is an installation instruction for the camera itself, not an
  optional accessory, so IP42 is stored.
- Hikvision `-C` datasheet filenames (DS-2CD2T47G2-L, DS-2CD2746G2-IZS): the PDFs print only
  the plain model name and no "-C" condition, so every value applies.
- Hikvision DS-2CD2143G2-I: audio line in/out is printed for "-S" only; the record is not
  "-S", so both ports are not listed.
- Dahua IPC-HFW2441T-ZS: prints "Protection IP67, IK10 (optional)" without saying what the
  option is, so `ikRating` is `null`. Audio in/out is "(Only - ZAS supports)"; the record is
  `-ZS`, so both ports are not listed.
- Axis M3098-LV, P3287-LVE: a "Sensor: Acoustic sensor" is printed, but never the word
  microphone, so `hasBuiltInMic` stays `false`.
- Axis M3088-V: the "humans, faces, vehicles ... license plates" class line sits under a bare
  "Metadata" heading and AXIS Scene Metadata is not named in this sheet's "Applications
  Included" list, unlike the other Axis sheets. Neither `face` nor `license-plate` is stored
  for it.
- Axis P3265-LVE: the 9 mm and 22 mm variants share one PDF but have different printed audio
  connectors (9 mm: terminal block for audio in and out; 22 mm: 3.5 mm mic/line in only).

### Printed classes that are not stored

- "license plates" was unmapped in the first pass and is now stored as `license-plate` (see
  Owner decisions): an AXIS Scene Metadata object class on M3098-LV, P3265-LVE, P1465-LE,
  P1467-LE, P1468-LE and P3287-LVE. No Hikvision or Dahua sheet in the catalog prints it.
- Axis object attributes (vehicle color, clothing color) and the BETA "PPE monitoring"
  scenario: not target classes.
- Dahua "People Counting" (IPC-EBW5641-AS): no "human" wording on the counting function itself.

### Changed or failed PDFs

None. No PDF differed from a previously recorded hash and no download failed.

### Owner decisions (2026-10-05, after the first pass)

- `-LIUF` records added for DS-2CD1023G2 and DS-2CD1043G2 (2.8 mm and 4 mm each, 4 records).
  Both sheets are titled `...-LIU(F)`, so every value is the same as the `-LIU` record of the
  same sheet. The reseller price is the shops' `-LIUF` listing; by owner decision the plain
  `-LIU` records carry the same price as their `-LIUF` sibling. The `-LIU` ids are unchanged.
  DS-2CD1323G2 got no `-LIUF` record: its sheet is titled `-LIU` only and names no `-LIUF`
  model, so its `-LIU` record still carries the `-LIUF` listing price.
- Axis `face` removed from all 10 Axis records that had it. The only source was the AXIS
  Scene Metadata class line ("humans, faces, vehicles"), not a named face-detection function.
  Hikvision and Dahua `face` values rest on "Face detection" / "Face Capture Yes" and stay.
- `license-plate` added as a detection type and stored for the 8 records of the 6 Axis models
  listed above. Its source is that same Scene Metadata class line.
- Display: the properties panel shows "IP rate: None" when no ingress rating is printed (no
  current record), and audio ports as Input / Output / IO.
- Dahua IPC-HFW2441T-ZS "IK10 (optional)": re-read; the sheet prints the phrase twice and
  never says what the option is (the optional accessories listed are a junction box, pole
  mount, power adapter and mount tester). Still stored as no IK rating; to be revisited.
