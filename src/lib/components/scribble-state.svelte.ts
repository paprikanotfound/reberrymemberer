import { PersistedState, StateHistory } from "runed";
import type { StrokeOptions } from "perfect-freehand";

export type Point = [number, number, number]; // [x, y, pressure]

export type Stroke = {
  points: Point[];
  box: {
    w: number;
    h: number;
  };
  targetBox?: {
    w: number;
    h: number;
  };
  color: string;
  options: StrokeOptions;
}

/**
 * Persisted state for the Scribble component.
 * This keeps the component pure while allowing state persistence at the parent level.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createPersistedScribble } from '$lib';
 *   import Scribble from '$lib/components/scribble.svelte';
 *
 *   const scribble = createPersistedScribble('my-scribble-key');
 * </script>
 *
 * <Scribble
 *   bind:strokes={scribble.content.strokes}
 *   bind:color={scribble.content.color}
 *   bind:size={scribble.content.size}
 *   bind:backgroundImage={scribble.content.backgroundImage}
 * />
 *
 * <button onclick={() => scribble.undo()}>Undo</button>
 * <button onclick={() => scribble.redo()}>Redo</button>
 * ```
 */
export type ScribbleContent = {
  strokes: Stroke[];
  backgroundImage: string | null; // base64 string
};

export type ScribbleTools = {
  color: string;
  size: number;
};

const DEFAULT_CONTENT: ScribbleContent = {
  strokes: [],
  backgroundImage: null,
};
const DEFAULT_TOOLS: ScribbleTools = {
  color: '#000000',
  size: 5,
};

export type PersistedScribble = ReturnType<typeof createPersistedScribble>;


export function clearPersistedScribble(key: string) {
  let scribble = new PersistedState<ScribbleContent>(
    key,
    DEFAULT_CONTENT,
    { storage: "local" }
  );
  scribble.current = DEFAULT_CONTENT;
}

export function createPersistedScribble(key: string) {
  let stateContent = new PersistedState<ScribbleContent>(
    key,
    DEFAULT_CONTENT,
    { storage: "local" }
  );
  let stateTools = new PersistedState<ScribbleTools>(
    key+"tools",
    DEFAULT_TOOLS,
    { storage: "local" }
  );
  let history = new StateHistory(() => stateContent.current, (c) => (stateContent.current = c));

  return {
    get history() { return history },
    get canUndo() { return history.canUndo },
    get canRedo() { return history.canRedo },
    get tools(): ScribbleTools {
      return stateTools.current
    },
    set tools(update: Partial<ScribbleTools>) {
      stateTools.current = {
        color: update.color ?? stateTools.current.color,
        size: update.size ?? stateTools.current.size,
      };
    },
    get content(): ScribbleContent {
      return stateContent.current;
    },
    set content(update: Partial<ScribbleContent>) {
      stateContent.current = {
        strokes: update.strokes ?? stateContent.current.strokes,
        backgroundImage: update.backgroundImage ?? stateContent.current.backgroundImage,
      };
    },
    undo() {
      history.undo();
    },
    redo() {
      history.redo();
    },
    resetContent() {
      stateContent.current = DEFAULT_CONTENT;
    },
  };
}
