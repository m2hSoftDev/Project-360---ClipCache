/**
 * Pure functions for preview sizing, aspect ratio fitting, and scaling calculations.
 * Used for full-image preview in the Side Panel (320px–500px width).
 */

export interface Dimensions {
  width: number;
  height: number;
}

export interface PreviewDimensions {
  displayWidth: number;
  displayHeight: number;
  scale: number;
}

/**
 * Calculates displayed dimensions for an image inside a container width
 * following CLAUDE.md layout rules: max-width: 100%, height: auto.
 *
 * @param natural Natural pixel dimensions of the image.
 * @param containerWidth Available inner width of the side panel container.
 */
export function calculatePreviewDimensions(
  natural: Dimensions,
  containerWidth: number
): PreviewDimensions {
  if (
    !natural ||
    natural.width <= 0 ||
    natural.height <= 0 ||
    containerWidth <= 0
  ) {
    return { displayWidth: 0, displayHeight: 0, scale: 1 };
  }

  // If image width exceeds container, scale it down to fit 100% container width
  if (natural.width > containerWidth) {
    const scale = containerWidth / natural.width;
    const displayHeight = Math.round(natural.height * scale);
    return {
      displayWidth: Math.round(containerWidth),
      displayHeight,
      scale,
    };
  }

  // If image is narrower than container, display at 1:1 scale
  return {
    displayWidth: Math.round(natural.width),
    displayHeight: Math.round(natural.height),
    scale: 1,
  };
}
