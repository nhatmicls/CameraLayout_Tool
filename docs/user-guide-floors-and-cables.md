# User guide: floors, cables, risers and shafts

Multi-floor projects and the provisional cable-length estimate.

## Floors

A project holds 1 to 20 floors, shown as tabs under the toolbar; tab 1 is the
lowest floor. Each floor has its own plan image, scale, cameras, sensors, walls, hubs, cables
and alarm devices, numbered per floor (C1, S1, F1, H1... start again on every floor). Cable
types, cable allowances, the fire-detector coverage mode and shafts belong to the whole project.
- Tabs: click to switch (the view refits each time), "+ Floor" adds one, double-click a name
  (or F2 / Enter) to rename, and the active tab has move left / move right, delete and a
  "floor-to-floor height" input (default 3.5 m, 0.5-30 m; not shown on the top floor). A new
  floor is empty until you load its plan. Switching floors is not an undo step; undo / redo
  takes you to the floor it changed. Deleting a floor can be undone.
- Replacing a floor's plan image clears that floor only and is one undo step.
- Linking a riser to a drop: select a riser or drop and click "Create paired point" to place
  the matching point on the floor above / below and link the two (or pick an existing point in
  "Linked to"). Only adjacent floors can be linked, one partner each. Until a route is drawn
  the typed values still apply ("Rises to" / "Goes down to" and "Length on the other floor").
- Route to a hub: on the floor where the cables arrive, select the linked point, click "Draw
  route to hub", click the route points and finish on a hub (Backspace removes the last point,
  Esc cancels). The route is a dotted line; with its point selected you can drag a route point,
  double-click the line to add one, double-click a point to remove one. Once the route exists,
  every cable ending on the partner point is measured as: its own route + the floor-to-floor
  height + the route (at that floor's scale) + the drop at the hub. The typed height and length
  are then ignored - expect the length to jump when you draw the route.
- Shafts: a vertical tube through several floors. Click "Shaft", click the plan, name it and
  choose the floor range: an opening (T1, T2... - the same label on every floor) is placed on
  each of those floors that has a plan, at the same position; drag each one to where the tube
  really is. A cable ending on an opening is labelled `F{n}_device_?` (not routed) until you specify
  where it exits. On the floor where it should leave, select that floor's shaft opening, open
  its panel list of incoming cables ("From Floor 2 F2_C1"), click "Route on <floor>" and draw the
  route points, finishing on a hub or a device of that floor (never on the opening itself). The
  cable is then labelled by what it reaches (`F1_C1_F1_H1`, `F2_S1_F3_P1`; the shaft never appears in a
  label, and the label follows riser / drop chains beyond the cable's final end). Length is measured as: route on the entry floor + sum of floor-to-floor heights +
  route on the exit floor (that floor's scale) + the end + slack. Remove or redraw a route from
  the same panel list. If the exit floor, the hub or device a route ends on, or the shaft
  opening is deleted, the route clears in the same undo step. A route that is not drawn yet is
  counted up to the opening only: the opening's typed "Length beyond this opening" (no vertical)
  and a notice.
- A cable that crosses floors is counted on the floor of its camera, sensor or fire-alarm
  device. Each floor is measured with its own scale; if a floor on the way has no scale the cable has no length and
  is reported, never guessed.
- Limits: plans of different floors are not aligned to each other; one route per riser / drop;
  floor heights are typed, not measured. Plan images are stored in the project file, which is
  limited to 80 MB: adding an image that would pass the limit is refused. A replaced or deleted
  plan image stays in memory while undo can still bring it back.

## Cables

A provisional cable-length estimate from routes you draw by hand.
- Hubs: click "Add hub" and click the plan to place a hub (switch, recorder, alarm panel);
  hubs are numbered H1, H2... and can be dragged. A hub has a mount height (default 1.5 m)
  and is where cables end. Hubs are not a BOM line.
- Risers and drops: "Add riser" places the point where cables go up to the floor above
  (R1, R2..., up arrow), "Add drop" the point where they go down to the floor below (D1,
  D2..., down arrow). Both work like a hub - cables end on them. A riser's "Rises to" is
  the height above this floor the cable climbs to (it starts at the route height, so set
  it); a drop's "Goes down to" is how far below this floor it ends (it starts at 0, i.e.
  the cable descends the route height). "Length on the other floor" (default 0) is added
  to every cable ending there, for the run from that point to its hub. In a project
  with several floors a riser can be linked to the drop on the floor above and the run
  measured from a drawn route instead of typed, and a shaft can carry cables through
  several floors - see Floors.
- While "Draw cable" is on, camera cones and sensor coverage are hidden so the route is
  drawn on a clear plan; they come back when you leave the tool.
- Drawing: click "Draw cable", click a camera, a sensor (either end of an IR beam), a
  fire-alarm device or a hub to start, click to add route points, then click any other device
  or hub to finish (but not the device you started on; no hub-to-hub cables). Backspace removes
  the last point, Esc cancels the cable, a second Esc leaves the tool. The cable takes the type
  chosen in the toolbar. A cable that starts on a device may end on another device, a hub, a
  riser, a drop or a shaft opening; a cable that starts on one of those must end on a device.
  An end on a device rises to that device's height and takes the device-end slack. A cable
  ending on a shaft opening has its own route beyond the shaft (see Shafts above).
- Editing: click a cable to select it, drag a point to move it, double-click the line to
  add a point, double-click a point to remove it. Deleting a camera, sensor, fire-alarm
  device or hub also removes its cables, in the same undo step.
- Cable types: name, optional length limit (m) and optional price (VND/m) - a new project
  starts with Cat6 UTP (90 m limit), Power 2-core and Alarm signal, all without a price.
  A type in use on any floor, or the last remaining type, cannot be deleted.
- How the estimate is built, per cable: horizontal route length (drawn route / scale) +
  the vertical run at each end (route height vs the device's and the hub's height) + the
  length on the other floor (riser / drop only) + slack at each end = the run; the run + spare % = what to buy. Per type the metres are summed
  and rounded up to a whole metre. Defaults (the "Allowances" section): spare 15 %, route
  height 3 m, device height 3 m (used for sensors and for cameras with no mounting height),
  slack 0.5 m at the device and 3 m at the hub.
- Range: every length is shown with a min-max range, e.g. `30.8 m (30.6-31.1 m)`. It is
  the worst case of the scale's click error only: each of the two scale clicks may be off
  by the "scale click error" (default 3 image px), which stretches or shrinks every
  horizontal length by the same factor. A very short reference line gives a warning.
- Length limit: a cable whose run (without spare) exceeds its type's limit is drawn red
  and dashed and listed as a warning; one that exceeds it only at the top of the range is
  dashed and listed as "may exceed".
- Limits: the route is 2D with straight segments - no conduit bends, no obstacles. The
  range does not cover image distortion, a perspective photo, or a wrongly typed reference
  length. This is not a voltage-drop or PoE-budget calculation. Sensors and fire-alarm
  devices have no mounting height, so they use the default device height. A cable end
  follows its camera, sensor, fire-alarm device or hub when the drag is dropped, not while
  dragging. There are no hub-to-hub links. A cable type's colour is its position in the
  type list. Measure on site before ordering.

Back to the [README](../README.md).
