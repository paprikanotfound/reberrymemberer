import type { Stroke } from "$lib/components/scribble-state.svelte";
import getStroke from "perfect-freehand";


export function drawObjectCover(
  ctx: CanvasRenderingContext2D, 
  img: HTMLImageElement, 
  canvasWidth: number, 
  canvasHeight: number,
  offsetYPercent: number = 0
) {
  const iw = img.width;
  const ih = img.height;
  const cw = canvasWidth;
  const ch = canvasHeight;

  const imgRatio = iw / ih;
  const canvasRatio = cw / ch;

  let sx = 0, sy = 0, sw = iw, sh = ih;

  // If image is wider than canvas (crop sides)
  if (imgRatio > canvasRatio) {
    sw = ih * canvasRatio;
    sx = (iw - sw) / 2;
  }
  // If image is taller than canvas (crop top/bottom)
  else {
    sw = iw;
    sh = iw / canvasRatio;
    // Center vertically
    const centerSy = (ih - sh) / 2;
    // Additional offset: % of full image height (not cropped height)
    const rawOffset = (-offsetYPercent / 100) * ih;
    // Final crop Y position
    sy = centerSy + rawOffset;
    // Clamp to stay within image bounds
    sy = Math.max(0, Math.min(sy, ih - sh));
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

export function drawStokes(
  ctx: CanvasRenderingContext2D, 
  targetWidth: number, 
  targetHeight: number, 
  strokes: Stroke[],
) {
  for (let str of strokes) {
    // Calculate scale factors based on the original stroke box
    const scaleX = str.targetBox ? (targetWidth / str.targetBox.w) : 1;
    const scaleY = str.targetBox ? (targetHeight / str.targetBox.h) : 1;
    const scale = Math.min(scaleX, scaleY);

    const stroke = getStroke(str.points, str.options);
    if (stroke.length === 0) continue;

    ctx.beginPath();
    ctx.moveTo(
      stroke[0][0] * scale,
      stroke[0][1] * scale
    );
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(
        stroke[i][0] * scale,
        stroke[i][1] * scale
      );
    }
    ctx.closePath();
    ctx.fillStyle = str.color;
    ctx.fill();
  }
}