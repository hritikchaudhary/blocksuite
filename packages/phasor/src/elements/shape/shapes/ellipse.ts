import type { RoughCanvas } from 'roughjs/bin/canvas.js';

import { type IBound, StrokeStyle } from '../../../consts.js';
import { Bound } from '../../../utils/bound.js';
import {
  lineEllipseIntersects,
  pointInEllipse,
} from '../../../utils/math-utils.js';
import { type IVec } from '../../../utils/vec.js';
import type { HitTestOptions } from '../../surface-element.js';
import type { ShapeElement } from '../shape-element.js';
import type { ShapeMethods } from '../types.js';

export const EllipseMethods: ShapeMethods = {
  render(
    ctx: CanvasRenderingContext2D,
    rc: RoughCanvas,
    element: ShapeElement
  ) {
    const {
      w,
      h,
      seed,
      strokeWidth,
      filled,
      realFillColor,
      realStrokeColor,
      strokeStyle,
      roughness,
    } = element;

    const renderOffset = Math.max(strokeWidth, 0) / 2;
    const renderWidth = Math.max(1, w - renderOffset * 2);
    const renderHeight = Math.max(1, h - renderOffset * 2);

    ctx.translate(renderOffset, renderOffset);

    rc.ellipse(renderWidth / 2, renderHeight / 2, renderWidth, renderHeight, {
      seed,
      roughness,
      strokeLineDash: strokeStyle === StrokeStyle.Dashed ? [12, 12] : undefined,
      stroke: realStrokeColor,
      strokeWidth,
      fill: filled ? realFillColor : undefined,
    });
  },

  hitTest(x: number, y: number, bound: IBound, options?: HitTestOptions) {
    return pointInEllipse(
      [x, y],
      [bound.x + bound.w / 2, bound.y + bound.h / 2],
      bound.w / 2,
      bound.h / 2
    );
  },

  intersectWithLine(start: IVec, end: IVec, element: ShapeElement): boolean {
    const bound = Bound.deserialize(element.xywh);
    return !!lineEllipseIntersects(
      start,
      end,
      bound.center,
      bound.w / 2,
      bound.h / 2
    );
  },
};
