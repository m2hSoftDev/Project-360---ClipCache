import { fabric } from 'fabric';

export interface Point {
  x: number;
  y: number;
}

/**
 * Computes the angle in degrees from start to end point.
 * Since fabric.Triangle points UP by default, adding 90 degrees aligns it along the vector direction.
 */
export function computeArrowAngle(start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}

/**
 * Computes the world/scene coordinates of an arrow group's head tip.
 */
export function getArrowTip(group: fabric.Group): Point {
  const head = group.getObjects()[1] as fabric.Triangle;
  const matrix = group.calcTransformMatrix();
  const pt = fabric.util.transformPoint(head.getPointByOrigin('center', 'top'), matrix);
  return { x: Math.round(pt.x), y: Math.round(pt.y) };
}

/**
 * Creates arrow line and triangle head assembled into ONE Fabric.js Group.
 * The triangle head uses (originX: 'center', originY: 'top') so that its tip
 * is placed PRECISELY at the drag end point in canvas coordinates.
 */
export function createArrowObjects(
  start: Point,
  end: Point,
  strokeColor: string,
  strokeWidth: number,
  zoom = 1
): {
  line: fabric.Line;
  head: fabric.Triangle;
  group: fabric.Group;
  tip: Point;
} {
  const angle = computeArrowAngle(start, end);
  const headSize = Math.max((strokeWidth * 3) / zoom, 16 / zoom);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const lineEndDistance = Math.min(len * 0.8, headSize * 0.7);
  const lineEndX = end.x - ux * lineEndDistance;
  const lineEndY = end.y - uy * lineEndDistance;

  const line = new fabric.Line([start.x, start.y, lineEndX, lineEndY], {
    stroke: strokeColor,
    strokeWidth: strokeWidth / zoom,
    selectable: false,
    evented: false,
    strokeLineCap: 'round',
  });

  const head = new fabric.Triangle({
    left: end.x,
    top: end.y,
    originX: 'center',
    originY: 'top',
    width: headSize,
    height: headSize,
    fill: strokeColor,
    angle,
    selectable: false,
    evented: false,
  });

  // Calculate tip BEFORE adding to group so it reflects canvas natural coordinates
  const tipCoords = head.getPointByOrigin('center', 'top');

  const group = new fabric.Group([line, head], {
    selectable: true,
  });

  return {
    line,
    head,
    group,
    tip: { x: tipCoords.x, y: tipCoords.y },
  };
}
