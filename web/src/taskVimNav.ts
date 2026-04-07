export const TASK_NAV_ROW_SELECTOR = "[data-task-nav-row]";

export function getLeftPaneNavRows(pane: HTMLElement | null): HTMLElement[] {
  if (!pane) {
    return [];
  }
  return Array.from(pane.querySelectorAll<HTMLElement>(TASK_NAV_ROW_SELECTOR));
}

export function applyTaskNavRowFocus(pane: HTMLElement | null, focusIndex: number): void {
  const rows = getLeftPaneNavRows(pane);
  rows.forEach((el, i) => {
    el.classList.toggle("TaskNavFocused", i === focusIndex && focusIndex >= 0);
  });
  if (focusIndex >= 0 && focusIndex < rows.length) {
    rows[focusIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

/** Copies "filepath:line" to clipboard — paste into a neovim buffer and hit gF to jump. */
export function copyNavRowToClipboard(el: HTMLElement): void {
  const path = el.getAttribute("data-nav-file");
  const line = el.getAttribute("data-nav-line");
  if (!path || !line) {
    return;
  }
  navigator.clipboard.writeText(`${path}:${line}`).catch(() => {
    /* clipboard write may be rejected if the page is not focused */
  });
}

export function collectSearchMatchIndices(
  rows: HTMLElement[],
  patternLower: string
): number[] {
  if (!patternLower) {
    return [];
  }
  const out: number[] = [];
  rows.forEach((row, i) => {
    const hay = (row.getAttribute("data-nav-search") ?? "").toLowerCase();
    if (hay.includes(patternLower)) {
      out.push(i);
    }
  });
  return out;
}
