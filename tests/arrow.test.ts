import { describe, it, expect } from 'vitest';
import { createArrowObjects, computeArrowAngle, getArrowTip } from '@/sidepanel/lib/arrowMath';

describe('Arrow Geometry & Tip Placement (CLAUDE.md Phase 4 Bug 2)', () => {
  it('arrow dragged from (100,100) to (300,200) has its head tip at (300,200) in natural-pixel coordinates', () => {
    const start = { x: 100, y: 100 };
    const end = { x: 300, y: 200 };
    const strokeColor = '#ef4444';
    const strokeWidth = 4;

    const arrow = createArrowObjects(start, end, strokeColor, strokeWidth);

    // 1. Verify angle computation: dx = 200, dy = 100
    const expectedAngle = (Math.atan2(100, 200) * 180) / Math.PI + 90;
    expect(computeArrowAngle(start, end)).toBeCloseTo(expectedAngle, 5);

    // 2. Arrow head tip equals the drag end point exactly
    expect(arrow.tip.x).toBe(300);
    expect(arrow.tip.y).toBe(200);

    // 3. Arrow tip from the unified group in canvas scene coordinates
    const groupTip = getArrowTip(arrow.group);
    expect(groupTip.x).toBe(300);
    expect(groupTip.y).toBe(200);

    // 4. Group contains line + head so they move together as one
    expect(arrow.group.getObjects()).toHaveLength(2);
    expect(arrow.group.selectable).toBe(true);
  });

  it('arrow head tip equals the drag end point for various angles', () => {
    const start = { x: 250, y: 250 };
    const testEndPoints = [
      { x: 450, y: 250 }, // Pointing East (0 deg)
      { x: 250, y: 450 }, // Pointing South (90 deg)
      { x: 50, y: 250 },  // Pointing West (180 deg)
      { x: 250, y: 50 },  // Pointing North (270 deg)
      { x: 100, y: 400 }, // Diagonal
    ];

    for (const end of testEndPoints) {
      const arrow = createArrowObjects(start, end, '#3b82f6', 6);
      expect(arrow.tip.x).toBe(end.x);
      expect(arrow.tip.y).toBe(end.y);
      const groupTip = getArrowTip(arrow.group);
      expect(groupTip.x).toBe(end.x);
      expect(groupTip.y).toBe(end.y);
    }
  });

  it('thick arrow line terminates before head tip so strokeLineCap does not extend past triangle tip', () => {
    const start = { x: 500, y: 150 };
    const end = { x: 200, y: 250 };
    const strokeWidth = 24;
    const arrow = createArrowObjects(start, end, '#ef4444', strokeWidth);

    // Tip remains at the exact drag point
    expect(arrow.tip.x).toBe(200);
    expect(arrow.tip.y).toBe(250);

    // The line end point must be recessed by at least the line cap radius (strokeWidth / 2 = 12)
    const lineX2 = arrow.line.x2 || 0;
    const lineY2 = arrow.line.y2 || 0;
    const distFromTip = Math.hypot(lineX2 - end.x, lineY2 - end.y);
    const capRadius = strokeWidth / 2;

    expect(distFromTip).toBeGreaterThanOrEqual(capRadius);
  });
});
