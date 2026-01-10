import { PersistedState, StateHistory } from "runed";
import type { Stroke } from "./canvas/types";

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
 *   bind:backgroundImageUrl={scribble.content.backgroundImageUrl}
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
  backgroundImageUrl: string | null;
};

const DEFAULT_CONTENT: ScribbleContent = {
  strokes: [],
  color: '#000000',
  size: 5,
  backgroundImageUrl: null,
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
        backgroundImageUrl: update.backgroundImageUrl ?? state.current.backgroundImageUrl,
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
