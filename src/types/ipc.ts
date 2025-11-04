export const IPC_CHANNELS = {
    PROJECT_NEW: "project:new",
    PROJECT_OPEN: "project:open",
    PROJECT_SAVE: "project:save",
    PROJECT_SAVE_AS: "project:save-as",
    SCENE_NEW: "scene:new",
    SCENE_DELETE: "scene:delete",
    SCENE_SAVE: "scene:save",
    DIALOG_OPEN_FOLDER: "dialog:open-folder",
    DIALOG_OPEN_FILE: "dialog:open-file",
    DIALOG_SAVE_FILE: "dialog:save-file",
    WINDOW_SHOW_WELCOME: "window:show-welcome",
    WINDOW_SHOW_EDITOR: "window:show-editor",
} as const;

export interface NewProjectOptions {
    name: string;
    projectPath: string;
    datapackPath: string;
    resourcepackPath: string;
    aspectRatio: "16:9" | "16:10" | "21:9";
    createNewFolders: boolean;
}

export interface OpenProjectResult {
    success: boolean;
    project?: unknown;
    error?: string;
}

export interface SaveProjectResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

export interface SelectFolderResult {
    canceled: boolean;
    filePath?: string;
}

export interface SelectFileResult {
    canceled: boolean;
    filePath?: string;
}

export interface SaveFileDialogResult {
    canceled: boolean;
    filePath?: string;
}
