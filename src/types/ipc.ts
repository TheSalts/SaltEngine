import type { Project } from "./project.js";
import type { Scene } from "./scene.js";

/**
 * IPC 채널 타입 정의
 */
export const IPC_CHANNELS = {
    // 프로젝트 관리
    PROJECT_NEW: "project:new",
    PROJECT_OPEN: "project:open",
    PROJECT_SAVE: "project:save",
    PROJECT_SAVE_AS: "project:save-as",
    
    // 씬 관리
    SCENE_NEW: "scene:new",
    SCENE_DELETE: "scene:delete",
    SCENE_SAVE: "scene:save",
    
    // 파일 다이얼로그
    DIALOG_OPEN_FOLDER: "dialog:open-folder",
    DIALOG_OPEN_FILE: "dialog:open-file",
    DIALOG_SAVE_FILE: "dialog:save-file",
    
    // 윈도우 관리
    WINDOW_SHOW_WELCOME: "window:show-welcome",
    WINDOW_SHOW_EDITOR: "window:show-editor",
} as const;

/**
 * 새 프로젝트 생성 옵션
 */
export interface NewProjectOptions {
    name: string;
    projectPath: string;
    datapackPath: string;
    resourcepackPath: string;
    aspectRatio: "16:9" | "16:10" | "21:9";
    createNewFolders: boolean;
}

/**
 * 프로젝트 열기 결과
 */
export interface OpenProjectResult {
    success: boolean;
    project?: Project;
    error?: string;
}

/**
 * 프로젝트 저장 결과
 */
export interface SaveProjectResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

/**
 * 폴더 선택 결과
 */
export interface SelectFolderResult {
    canceled: boolean;
    filePath?: string;
}

/**
 * 파일 선택 결과
 */
export interface SelectFileResult {
    canceled: boolean;
    filePath?: string;
}

/**
 * 파일 저장 다이얼로그 결과
 */
export interface SaveFileDialogResult {
    canceled: boolean;
    filePath?: string;
}

