# User guide: plan, cameras, walls and view

How to load a plan, place cameras, read the coverage cones, draw walls and hide layers.

## Floor plan + scale

Load a PNG/JPEG, draw a reference line of known length to calibrate.

## Camera catalog

106 records across Hikvision, Dahua and Axis (one per lens option), every
optical spec transcribed from the official datasheet. Each card also shows the datasheet's
IP / IK rating, built-in mic or speaker, and the target classes its on-device analytics
print (human / vehicle / face / license plate); the properties panel adds audio ports. "Not
listed"
means the datasheet does not print it, not that the camera lacks it. Filter by brand, form
factor, "only models with a listed price", outdoor rating (IP65+), built-in mic, and
human / vehicle detection.

## Placement

Drag from the catalog, move, rotate with the handle, adjust range and (for
varifocal lenses) HFOV in the properties panel. Cameras are numbered C1, C2... per floor in array order (first placed is C1). Labels renumber when you delete an earlier camera. Undo/redo.

## DORI coverage

Each cone is banded Identify / Recognize / Observe / Detect per EN 62676-4.

## Mounting height + tilt

(Optional, per camera) click "Set mounting height + tilt" in the
properties panel and enter the lens height and the downward tilt. The cone then shows floor
coverage: it starts at the blind spot under the camera and ends at the far edge of the view
(or at the range, whichever is nearer). The panel lists blind spot, far edge and where each
DORI threshold lands on the floor, next to the datasheet's illumination range, and warns
when the far edge is beyond that range (it never clips to it). Vertical FOV is the datasheet
value where the datasheet prints one, otherwise computed from HFOV and the sensor aspect
ratio and labelled as computed. Cameras without a mounting height keep the flat cone.
Approximations: DORI floor distances use the slant distance from the lens
(`sqrt(d² - h²)`), blind spot and far edge are centre-line values drawn as arcs (the true
footprint is a trapezoid), and tilt is ignored for fisheye lenses (HFOV >= 180°).

## PTZ cameras

PTZ models are drawn as one cone at the bearing you set (2.8-12 mm zoom adjustable like any
varifocal lens); the pan sweep is not modelled.

## Walls

Click "Draw walls" and click points on the plan to draw wall segments, opaque or
glass; leave gaps for doors. Every camera's cone is clipped live to what the camera can see
past the opaque walls, also while you drag it. Walls can be selected, switched between
opaque and glass, deleted and undone, and are saved with the project and drawn in the PNG.
Outside drawing mode every wall end shows a dot you can drag to reshape the wall: walls
joined at that point move together, the dot snaps onto other wall ends, and cones update
when you drop it.
Drawing: points snap to existing wall endpoints (endpoint to endpoint only - no angle or grid
snap); double-click or Esc ends a chain; drag to pan while drawing. Walls are expected to
meet at endpoints - a wall that crosses another is kept but flagged with a warning, also
when you open a file that contains crossings.
Limits: the model is 2D only. An opaque wall is treated as infinitely tall and with no
thickness, so mounting height never lets a camera see over one. Glass never blocks cameras.
For sensors: opaque walls clip PIR, thermal and vibration / glass-break coverage; glass is
also treated as blocking PIR and thermal (long-wave IR does not pass ordinary glass) but
not vibration / glass-break circles; an IR beam is not clipped, it is flagged as blocked
when an opaque wall crosses it. For fire-alarm detectors: fire detector coverage circles (in
TCVN 5738 mode only) are clipped by both opaque and glass walls. There are no low
obstacles and no furniture. Walls are drawn by hand, not detected from the image. A wall
within 0.3 m of a camera is treated as the wall it is mounted on and ignored for that
camera - so a camera aimed back through its mounting wall is shown seeing into the next
room. The same 0.3 m rule applies to sensors, fire-alarm detectors, and to both ends of a beam.

## View

Collapsed section at the top of the right panel with toggles to hide / show layer groups on the active floor. Includes 16 toggles: camera markers, camera FOV cones, each camera form factor (bullet, dome, turret, PTZ, fisheye), sensor markers (including IR beam line + ends), sensor coverage shapes (including thermal cones), each sensor kind (PIR, IR beam, vibration, thermal), hubs / risers / drops, cable routes (including trunk routes to hubs on other floors), and walls. Every toggle option is always listed with a live item count for the active floor; a "N hidden" badge shows when any are off; "Show all" resets all to visible. The Cameras, Sensors and Cabling headings are parent checkboxes: unticking one unticks every row under it, ticking it turns them all on, and it shows a dash when only some rows are on. The per-type rows sit under their own parent ("Types" for cameras, "Kinds" for sensors) that works the same way; a type that is off hides both the marker and the cone / coverage of those items. Hidden walls still block camera cones and sensor coverage. A drawing tool (wall, hub, cable, trunk) forces its own layers visible while the tool is active and restores the previous state when leaving. Labels never renumber when items are hidden, and a cable is still drawn to a hidden camera, sensor or hub. Hiding the type of the selected item deselects it; dropping a catalog card of a hidden type turns that type back on. The PNG export (both "Export PNG" and "Export all floors") draws the on-screen state for that floor: if anything is hidden, the strip prints a wrapped "Shown: ... / Hidden: ..." note under the legend; legend lines, BOM strip, BOM panel, CSV and cable estimate always cover everything. Fire-alarm devices and their coverage are always drawn (no toggle). View state is not saved in the project file, not undoable, is kept when you switch floors, and is reset to all visible when a project is opened or a new plan image is loaded.

Back to the [README](../README.md).
