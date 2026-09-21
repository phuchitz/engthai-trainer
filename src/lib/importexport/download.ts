/**
 * Saves text to a file the learner chooses a home for.
 *
 * Returns a boolean rather than throwing on failure: the caller must be able to say
 * "that did not work" instead of claiming a backup exists when none does.
 */
export function downloadText(filename: string, text: string, type = "application/json"): boolean {
  if (typeof document === "undefined") return false;

  let url: string | null = null;
  try {
    const blob = new Blob([text], { type });
    url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    return false;
  } finally {
    // Revoking immediately is safe: the download has already been handed to the browser.
    if (url) URL.revokeObjectURL(url);
  }
}

export async function readFileAsText(file: File): Promise<string> {
  return file.text();
}
