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
  color: string;
  size: number;
  backgroundImage: string | null; // base64 string
};

const DEFAULT_CONTENT: ScribbleContent = {
  strokes: [],
  color: '#000000',
  size: 5,
  backgroundImage: null,
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
  let state = new PersistedState<ScribbleContent>(
    key,
    DEFAULT_CONTENT,
    { storage: "local" }
  );
  let history = new StateHistory(() => state.current, (c) => (state.current = c));

  return {
    get history() { return history },
    get canUndo() { return history.canUndo },
    get canRedo() { return history.canRedo },
    get content(): ScribbleContent {
      return state.current;
    },
    set content(update: Partial<ScribbleContent>) {
      state.current = {
        strokes: update.strokes ?? state.current.strokes,
        color: update.color ?? state.current.color,
        size: update.size ?? state.current.size,
        backgroundImage: update.backgroundImage ?? state.current.backgroundImage,
      };
    },
    undo() {
      history.undo();
    },
    redo() {
      history.redo();
    },
    resetContent() {
      state.current = DEFAULT_CONTENT;
    },
  };
}
