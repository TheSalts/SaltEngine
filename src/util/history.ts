import type { Scene } from "../types/scene.js";

export interface HistoryState {
    scenes: Scene[];
    timestamp: number;
}

export class HistoryManager {
    private undoStack: HistoryState[] = [];
    private redoStack: HistoryState[] = [];
    private maxHistorySize: number = 50;

    pushState(scenes: Scene[]): void {
        const state: HistoryState = {
            scenes: this.deepCopyScenes(scenes),
            timestamp: Date.now(),
        };

        this.undoStack.push(state);
        this.redoStack = [];

        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
    }

    undo(): HistoryState | null {
        if (this.undoStack.length <= 1) {
            return null;
        }

        const currentState = this.undoStack.pop();
        if (currentState) {
            this.redoStack.push(currentState);
            const previousState = this.undoStack[this.undoStack.length - 1];
            return previousState ? { ...previousState, scenes: this.deepCopyScenes(previousState.scenes) } : null;
        }

        return null;
    }

    redo(): HistoryState | null {
        if (this.redoStack.length === 0) {
            return null;
        }

        const state = this.redoStack.pop();
        if (state) {
            this.undoStack.push(state);
            return { ...state, scenes: this.deepCopyScenes(state.scenes) };
        }

        return null;
    }

    canUndo(): boolean {
        return this.undoStack.length > 1;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    private deepCopyScenes(scenes: Scene[]): Scene[] {
        return JSON.parse(JSON.stringify(scenes));
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}
