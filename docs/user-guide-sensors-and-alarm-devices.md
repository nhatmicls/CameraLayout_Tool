# User guide: sensors, fire alarm and control panels

The Sensors, Fire alarm and Control panel tabs of the catalog sidebar.

## Sensors

The sidebar's Sensors tab holds 31 records across Hikvision, Dahua, Bosch and
Takex (21 PIR motion, 3 IR beam, 5 vibration / glass-break, 2 thermal), every spec copied
from the official datasheet or the manufacturer's install manual (one wired ceiling PIR,
DS-PDCL12-EG2, from the specification table of its official hikvision.com product page). The tab also lists
three marker-only kinds from the alarm catalog - magnetic contacts (8), an environment
(temperature) detector (1) and intrusion detectors (2: a glass-break and an outdoor motion
detector for which no datasheet exists, so no range can be drawn): they are placed as a
marker with no coverage shape and numbered with the other alarm devices under shared prefixes (S for smoke detector and sensor, H for heat detector and plain hub, E for call point and expander, etc.). Thermal cameras live here, not in the
camera catalog. Drag a card onto the plan like a camera; sensors are numbered per the shared prefix counter (S1, S2...) and
have their own properties panel. Labels are numbered per floor, per prefix, across all kinds that share it - placing / deleting an item renumbers later items with the same prefix. Filters: Brand, Type and "Works with" drop-downs (see
Control panel tab).
- PIR: a sector at the datasheet range and angle (a ceiling PIR is a full 360° circle).
  Range and angle can be reduced, never raised above the datasheet.
- IR beam: a straight line between two draggable ends (transmitter and receiver). An
  Indoor / Outdoor switch picks which datasheet maximum distance applies. The line turns
  dashed with a warning when it is longer than that maximum or an opaque wall crosses it;
  crossing glass only adds a note.
- Vibration / glass-break: a circle of the datasheet radius.
- Thermal: a flat sector at the datasheet HFOV, banded by the datasheet's human detection /
  recognition / identification distances - these are not EN 62676-4 DORI. A new thermal
  cone is drawn at 100 m or the datasheet detection distance, whichever is smaller; you can
  raise it to the datasheet figure.
- Magnetic contact / environment detector / intrusion detector: markers only, no coverage
  shape, labelled F1, F2... with the other alarm devices.

Limits: coverage shapes are the datasheet's nominal figures - a planning aid, not a
detection guarantee. Real coverage depends on mounting, lens masks, temperature and
environment. Mounting height and tilt are not modelled for sensors. A datasheet that prints
feet only is converted to metres (x 0.3048, rounded to 0.1 m) and marked "converted from
ft"; no current record needs it.

## Fire alarm / alarm panels

The sidebar's Fire alarm tab holds Hikvision detectors and
call points: 6 smoke (including 1 standalone and 2 wired 4-wire), 3 heat (one is an AoLin
12 V conventional detector), 2 CO, 8 manual call points / panic buttons, 6 sounders (25
records). A card whose model has no official document shows "no datasheet" instead of a
link. Specs copied from the official Hikvision datasheet or the
AX PRO user manual. The AX lines are intrusion alarm systems (the AX PRO manual lists
detectors as peripherals), not certified fire-alarm control panels; emergency buttons are
portable panic buttons, not fire call points. Drag a card onto the plan (scale required);
devices are numbered by kind (S for smoke, H for heat, etc.), shared with sensor numbering (S for sensors and smoke, H for heat detectors and plain hubs, etc.). A device whose model is no longer in the catalog is labelled `?1`, `?2`... Labels are numbered per floor per shared prefix, and placing / deleting an item renumbers later items with the same prefix. Placement: select, drag, delete, undo/redo.
- **Coverage modes** (toolbar control, shown when the Fire alarm tab is active or a device
  is placed): "Datasheet" draws markers only (no detector prints a protection area). "TCVN
  5738" mode (Vietnam standard, clause 6.13 Bảng 1 for smoke up to 12 m, clause 6.15.1 Bảng 2
  for heat up to 9 m) draws, for smoke and heat detectors, a dashed circle of equal area to
  the standard's "average protected area per detector" (`r = sqrt(A / pi)`). The circle
  approximates an area + spacing-grid rule, so circles on a compliant grid leave gaps at the
  corners. Ceiling beams, projections, narrow rooms and the condition "not larger than the
  detector's own documents" are not modelled. No circle is drawn for CO detectors, for a
  ceiling height above the table's last band, or when no scale is set. Circles are clipped by opaque and
  glass walls (same 0.3 m mounting-wall rule); hidden in cable mode. Limits: the circles
  are planning aids, not a fire-safety design or a compliance check. The shipped detectors
  are intrusion-system or standalone smoke alarms, not certified to TCVN 5738; verify
  against the official standard text. The table numbers were read from the full-text
  reprint on dulieuphapluat.vn; the toolbar control and the properties panel link to that
  page so you can open the document the circles are based on.
- **Compatibility** is controller-centric: it is stored only on control panel / hub records
  and shown only on their cards (Control panel tab) as a count with a "View list" button;
  the popup lists each device with its source link and note. An entry is either a row of
  one of Hikvision's two official model-by-model lists (AXPRO Series Compatibility List,
  AX HYBRID PRO Device Compatibility List) or, for the wired 4-wire devices and their
  brackets, an owner decision (2026-10-08): such an entry says so in its note and links to
  the panel datasheet, because Hikvision's list has no row for conventional wired zone
  devices. Two readings to know about:
  a "—" cell on the AX HYBRID PRO list is taken as "compatible with every firmware
  version" (the page prints no legend), and the AXPRO list writes rows as "-WE/WB", so each
  variant is attached to the hub of the same frequency (868 MHz DS-PWA96-M-WE with `-WE`,
  433 MHz DS-PWA96-M2H-WB with `-WB`). Wireless devices on an AX Hybrid PRO panel need the
  bus wireless receiver DS-PM1-RT-HWB (in the Control panel tab); the app does not check
  that one is placed.
- Warnings: a placed alarm device (any tab's F-numbered device) is flagged when it is "not
  listed" for any placed panel / hub, with one combined line when no panel / hub is placed.
  "Not listed" means no official statement was found, not proof of incompatibility.
  Standalone devices are never flagged, and placed coverage sensors (S-numbered) are never
  flagged - for them compatibility is a catalog filter only. Capacity is shown as printed on
  the datasheet (display only; no assignment or capacity checks).

## Control panel tab

The alarm system's own hardware - 3 AX Hybrid PRO control panels and 2 AX PRO hubs (868 MHz and 433 MHz), plus their modules: expanders / the bus wireless
receiver, keypads, a keyfob, relay modules, a repeater, communicator modules and 8 detector mounting brackets
(accessory kind; tag reader and power supply kinds exist but have no records yet). All are placed as
markers.
- **Filters** (Sensors, Fire alarm and Control panel tabs): Brand and Type drop-downs, and
  one shared "Works with" drop-down listing every control panel / hub in two groups,
  "Placed in this project" and "Not placed". Choosing one shows only the devices that
  panel's official compatibility entries name (in the Control panel tab the chosen panel
  stays visible); the choice carries across the three tabs. A hidden device is "not
  listed", not proven incompatible - with a panel chosen, the Sensors tab therefore hides
  every sensor that panel's list does not name, including all other brands.

## Alarm-device prices

35 of the 62 alarm-catalog records have a Vietnamese price (24 from the nhaantoan.com price
list of 2026-10-08, 11 from vuhoangtelecom.vn); 19 more link to a contact-for-price page on
mastery.vn; the rest are "price on request". No Shopee listing could be verified.

Back to the [README](../README.md).
