// Turns the result of an eager `import.meta.glob` over `data/<brand>/<device-type>/*.json`
// into a stable, ordered list of data files. Order = the given brand order, then file path,
// so `..._01.json` loads before `..._02.json` and adding a numbered file needs no loader edit.

/** One bundled catalog data file: its path below `data/` and its raw JSON text. */
export interface CatalogDataFile {
  /** e.g. `hikvision/camera-bullet/hikvision-camera-bullet_01.json` - used in error messages. */
  label: string;
  /** Brand folder the file sits in (first path segment below `data/`). */
  brandFolder: string;
  /** Device-type folder (second path segment), e.g. `camera-bullet` or `sensor-pir`. */
  deviceTypeFolder: string;
  raw: string;
}

const DATA_ROOT_MARKER = "/data/";

export function orderCatalogDataFiles(
  rawByGlobPath: Record<string, string>,
  brandOrder: readonly string[],
): CatalogDataFile[] {
  const files = Object.entries(rawByGlobPath).map(([globPath, raw]): CatalogDataFile => {
    const label = globPath.slice(globPath.lastIndexOf(DATA_ROOT_MARKER) + DATA_ROOT_MARKER.length);
    const [brandFolder = "", deviceTypeFolder = ""] = label.split("/");
    return { label, brandFolder, deviceTypeFolder, raw };
  });
  // A brand folder missing from `brandOrder` sorts last; the schema brand enum is what
  // rejects an unknown brand.
  const rank = (file: CatalogDataFile): number => {
    const index = brandOrder.indexOf(file.brandFolder);
    return index === -1 ? brandOrder.length : index;
  };
  return files.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}
