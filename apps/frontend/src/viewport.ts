// Viewport thresholds and current size. Leaf module (imports nothing) so components can share these without import cycles.

export const MOBILE_WIDTH_THRESHOLD = 1200;
export const MOBILE_HEIGHT_THRESHOLD = 900;

export let viewportWidth: number;
export let viewportHeight: number;

/**
 * Update the current viewport size.
 * @param {number} width - The current viewport width in pixels.
 * @param {number} height - The current viewport height in pixels.
 */
export function setViewport(width: number, height: number): void {
  viewportWidth = width;
  viewportHeight = height;
}
