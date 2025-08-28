import { PersistedState } from "runed" // adjust import path if different
import type { CanvasTool } from "./canvas.types"


export type PersistedCanvasTools = ReturnType<typeof createCanvasTools>;

type CanvasTools = {
  tool: CanvasTool;
  color: string;
  size: number;
}

export function createCanvasTools(
  key: string,
  init: CanvasTools,
  options: CanvasTool[],
	colors: string[],
) {
  let tools = new PersistedState<CanvasTools>(key + "_canvas_tools", init, { storage: "local" });
	return {
    options,
    colors,
    get tool() { return tools.current.tool },
    set tool(tool: CanvasTool) { 
      tools.current.tool = tool
    },
    get color() { return tools.current.color },
    set color(color: string) { 
      tools.current.color = color
    },
    get size() { return tools.current.size },
    set size(size: number) { 
      tools.current.size = size
    },
	};
}