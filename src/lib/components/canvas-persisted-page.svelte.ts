import { PersistedState, StateHistory } from "runed" // adjust import path if different
import type { CanvasContent, Stroke } from "./canvas.types"
import { POSTCARD } from "$lib/types";
import { drawObjectCover, drawStokes } from "$lib/utils/utils.canvas";
import { loadImage } from "$lib/utils/utils.image";
import { base64ToBlob } from "$lib/utils/utils.file";


const DEFAULT_CONTENT = { strokes: [], bgOffsetX: 0, bgOffsetY: 0 }

export type PersistedPage = ReturnType<typeof createPersistedPage>;


export function clearPersistedPage(key: string) {
  let page: PersistedState<CanvasContent> = new PersistedState<CanvasContent>(
    key, DEFAULT_CONTENT, { storage: "local" });
  page.current = DEFAULT_CONTENT
}


export function createPersistedPage(key: string) {

  let page: PersistedState<CanvasContent> = new PersistedState<CanvasContent>(
    key, DEFAULT_CONTENT, { storage: "local" }
  );
  let history = new StateHistory(() => page.current, (c) => (page.current = c));


  const exportImage = async (type?: string, quality?: number) => {
    return new Promise<Blob>(async (res, rej) => {
      const canvas = document.createElement("canvas");
      canvas.width = POSTCARD.size.w;
      canvas.height = POSTCARD.size.h;
      // ctx
      const ctx = canvas.getContext("2d");
      if (!ctx) return rej("No 2D context");
      // bg color
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // bg img
      if (page.current.bg) {
        const elmImage = await loadImage(base64ToBlob(page.current.bg));
        if (!elmImage) return rej("Background not loaded");
        drawObjectCover(ctx, elmImage, canvas.width, canvas.height, page.current.bgOffsetY);
      }
      // strokes
      drawStokes(ctx, canvas.width, canvas.height, page.current.strokes);
      // save
      canvas.toBlob(blob => {
        if (blob) res(blob);
        else rej("Failed to export blob");
      }, type, quality);
    })
  }
  
	return {
    get history() { return history },
    get canUndo() { return history.canUndo },
    get canRedo() { return history.canRedo },
    get content(): CanvasContent { return page.current },
		set content(update: { 
      strokes?: Stroke[], 
      bg?: CanvasContent['bg'], 
      bgOffset?: { x: number, y: number},
    }) {
      page.current = { 
        strokes: update?.strokes ?? page.current.strokes, 
        bg: update?.bg ?? page.current.bg, 
        bgOffsetX: update.bgOffset?.x ?? page.current.bgOffsetX,
        bgOffsetY: update.bgOffset?.y ?? page.current.bgOffsetY,
      };
    },
    resetContent() {
      // history.log = [] // reset history
      page.current = DEFAULT_CONTENT
    },
    exportImage,
	};
}