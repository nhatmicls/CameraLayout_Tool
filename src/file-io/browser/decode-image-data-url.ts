/**
 * Decodes an embedded `data:image/...` URL into a real `HTMLImageElement`,
 * rejecting with a user-facing message on any failure. Moved out of
 * `project-file-save-and-load.ts` (multi-floor phase 1) because loading a
 * project now decodes one of these per floor that has an image, not just one.
 */
export function decodeEmbeddedImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const element = new Image()
    element.onload = () => {
      element
        .decode()
        .then(() => resolve(element))
        .catch(() => reject(new Error('The project file is corrupt: its embedded image failed to decode.')))
    }
    element.onerror = () => reject(new Error('The project file is corrupt: its embedded image failed to decode.'))
    element.src = dataUrl
  })
}
