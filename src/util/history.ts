import type { Scene } from "../types/scene.js";

/**
 * 히스토리 상태 타입
 */
export interface HistoryState {
    scenes: Scene[];
    timestamp: number;
}

/**
 * 히스토리 관리 클래스
 */
export class HistoryManager {
    private undoStack: HistoryState[] = [];
    private redoStack: HistoryState[] = [];
    private maxHistorySize: number = 50;

    /**
     * 현재 상태를 히스토리에 추가합니다.
     */
    pushState(scenes: Scene[]): void {
        const state: HistoryState = {
            scenes: this.deepCopyScenes(scenes),
            timestamp: Date.now(),
        };

        this.undoStack.push(state);
        this.redoStack = []; // Redo 스택 초기화

        // 최대 크기 제한
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
    }

    /**
     * Undo 작업을 수행합니다.
     */
    undo(): HistoryState | null {
        if (this.undoStack.length <= 1) {
            return null; // 현재 상태만 있으면 Undo 불가
        }

        const currentState = this.undoStack.pop();
        if (currentState) {
            this.redoStack.push(currentState);
            const previousState = this.undoStack[this.undoStack.length - 1];
            return previousState ? { ...previousState, scenes: this.deepCopyScenes(previousState.scenes) } : null;
        }

        return null;
    }

    /**
     * Redo 작업을 수행합니다.
     */
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

    /**
     * Undo 가능 여부를 반환합니다.
     */
    canUndo(): boolean {
        return this.undoStack.length > 1;
    }

    /**
     * Redo 가능 여부를 반환합니다.
     */
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /**
     * Scene 배열을 깊은 복사합니다.
     */
    private deepCopyScenes(scenes: Scene[]): Scene[] {
        return JSON.parse(JSON.stringify(scenes));
    }

    /**
     * 히스토리를 초기화합니다.
     */
    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
}

