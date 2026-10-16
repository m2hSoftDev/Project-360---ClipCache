/**
 * Math and scaling utilities for Fabric.js canvas display and natural-size image export.
 * Per CLAUDE.md Phase 4: Display canvas at panel width (ResizeObserver),
 * while keeping export at full natural pixel resolution.
 */

export interface Dimensions {
  width: number;
  height: number;
}

export interface CanvasDisplayLayout {
  displayWidth: number;
  displayHeight: number;
  scale: number;
  exportMultiplier: number;
}

/**
 * Calculates display dimensions and scaling factor to fit the image into the
 * side panel container width while computing the reciprocal multiplier needed
 * to export at natural resolution.
 */
export function computeCanvasLayout(
  naturalSize: Dimensions,
  containerWidth: number
): CanvasDisplayLayout {
  if (
    !naturalSize ||
    naturalSize.width <= 0 ||
    naturalSize.height <= 0 ||
    containerWidth <= 0
  ) {
    return {
      displayWidth: 0,
      displayHeight: 0,
      scale: 1,
      exportMultiplier: 1,
    };
  }

  // Scale down if image width exceeds panel width
  if (naturalSize.width > containerWidth) {
    const scale = containerWidth / naturalSize.width;
    const displayWidth = containerWidth;
    const displayHeight = naturalSize.height * scale;
    const exportMultiplier = 1 / scale;

    return {
      displayWidth,
      displayHeight,
      scale,
      exportMultiplier,
    };
  }

  // Otherwise display at 1:1 scale
  return {
    displayWidth: naturalSize.width,
    displayHeight: naturalSize.height,
    scale: 1,
    exportMultiplier: 1,
  };
}

/**
 * Calculates the exact output dimensions when exporting a canvas with a given multiplier.
 */
export function calculateExportDimensions(
  displaySize: Dimensions,
  exportMultiplier: number
): Dimensions {
  return {
    width: Math.round(displaySize.width * exportMultiplier),
    height: Math.round(displaySize.height * exportMultiplier),
  };
}

/**
 * Asserts that the computed export dimensions match the original natural dimensions,
 * within a 1-pixel rounding tolerance.
 */
export function isNaturalResolutionPreserved(
  displaySize: Dimensions,
  naturalSize: Dimensions,
  exportMultiplier: number,
  tolerance = 1
): boolean {
  const exported = calculateExportDimensions(displaySize, exportMultiplier);
  const widthDiff = Math.abs(exported.width - naturalSize.width);
  const heightDiff = Math.abs(exported.height - naturalSize.height);

  return widthDiff <= tolerance && heightDiff <= tolerance;
}
