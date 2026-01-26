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
export type ScribbleContent = {
  strokes: Stroke[];
  backgroundImage: string | null; // base64 string
  backgroundOffsetX: number;
  backgroundOffsetY: number;
  _version?: number; // Schema version for migrations
};
export type ScribbleTools = {
  color: string;
  size: number;
};

const CURRENT_VERSION = 1;
const DEFAULT_CONTENT: ScribbleContent = {
  strokes: [],
  backgroundImage: null,
  backgroundOffsetX: 0,
  backgroundOffsetY: 0,
  _version: CURRENT_VERSION,
};
const DEFAULT_TOOLS: ScribbleTools = {
  color: '#000000',
  size: 5,
};

/**
 * Migrate old schema versions to the current version
 */
function migrateContent(data: any): ScribbleContent {
  // If no version, it's the old schema without offset fields
  if (!data._version) {
    return {
      strokes: data.strokes || [],
      backgroundImage: data.backgroundImage || null,
      backgroundOffsetX: 0, // Default value for old data
      backgroundOffsetY: 0, // Default value for old data
      _version: CURRENT_VERSION,
    };
  }

  // Already current version
  return data as ScribbleContent;
}

/**
 * Save data to localStorage
 */
function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e);
  }
}

export function clearPersistedScribble(key: string) {
  saveToStorage(key, DEFAULT_CONTENT);
  saveToStorage(key + "tools", DEFAULT_TOOLS);
}

export function createPersistedScribble(key: string) {
  // Load initial state from localStorage with migration
  let contentState = new PersistedState(key, DEFAULT_CONTENT, {
    serializer: {
      serialize: JSON.stringify,
		  deserialize: (c) => migrateContent(JSON.parse(c))
    }
  });
  let toolsState = new PersistedState(key + "tools", DEFAULT_TOOLS);

  // Create history for undo/redo
  let history = new StateHistory(() => contentState.current, (c) => {
    contentState.current = c;
  });


  return {
    get history() { return history },
    get canUndo() { return history.canUndo },
    get canRedo() { return history.canRedo },
    get tools() { return toolsState.current; },
    get content() { return contentState.current; },
    undo() { history.undo(); },
    redo() { history.redo(); },
    resetContent() {
      contentState.current = DEFAULT_CONTENT;
      saveToStorage(key, contentState);
    },
  };
}


export type PersistedScribble = ReturnType<typeof createPersistedScribble>;