import { RectangularBounds as Rectangle } from './Rectangle';

export function rectangleWidth( rect:Rectangle):number { return rect.maxX - rect.minX; }
export function rectangleHeight(rect:Rectangle):number { return rect.maxY - rect.minY; }
