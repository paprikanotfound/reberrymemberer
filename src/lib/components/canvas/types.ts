import type { StrokeOptions } from "perfect-freehand";

export type Point = [number, number, number]; // [x, y, pressure]

export type Stroke = {
  points: Point[];
  box: {
    w: number;
    h: number;
  };
  color: string;
  options: StrokeOptions;
}

export const BRUSH_COLORS = [
    "#000000", "#ffffff", "#9FA8B2", "#E085F4", "#AE3EC8", 
    "#4465E9", "#4CA1F1", "#F1AC4B", "#E16919", 
    "#079268", "#4BB05E", "#F87777", "#E03130"
]

export const BRUSH_COLORS_TEXT = [
    "#000000", "#AE3EC8", "#00078F", "#079268", "#E03130"
]

export const BRUSH_SIZES = [ 
  { label: "XS", size: 2 },
  { label: "S", size: 3 },
  { label: "M", size: 5 }, 
  { label: "L", size: 7 }, 
  { label: "XL", size: 10 } 
]

export type CanvasTool = "brush"|"eraser"|"drag"|"bg"

export type BrushOpt = {
  color: string;
  size: number
}

export type CanvasContent = { 
  strokes: Stroke[]; 
  bg?: string;
  bgOffsetX: number;
  bgOffsetY: number;
}