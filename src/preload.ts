import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
    openProjectDialog: () => ipcRenderer.invoke("project:open-dialog"),
    saveProjectDialog: (defaultPath?: string) => ipcRenderer.invoke("project:save-dialog", defaultPath),
    readProjectFile: (filePath: string) => ipcRenderer.invoke("project:read-file", filePath),
    writeProjectFile: (filePath: string, data: string) => ipcRenderer.invoke("project:write-file", filePath, data),
    selectFolder: (title: string) => ipcRenderer.invoke("dialog:select-folder", title),
    createFolder: (folderPath: string) => ipcRenderer.invoke("fs:create-folder", folderPath),
    folderExists: (folderPath: string) => ipcRenderer.invoke("fs:folder-exists", folderPath),
    switchToEditor: (projectData: unknown) => ipcRenderer.invoke("window:switch-to-editor", projectData),
    switchToWelcome: () => ipcRenderer.invoke("window:switch-to-welcome"),
    getCurrentProject: () => ipcRenderer.invoke("project:get-current"),
    findProjectFiles: (folderPath: string) => ipcRenderer.invoke("project:find-files", folderPath),
    selectImageFile: () => ipcRenderer.invoke("asset:select-image"),
    copyFile: (sourcePath: string, destPath: string) => ipcRenderer.invoke("fs:copy-file", sourcePath, destPath),
    getFileExtension: (filePath: string) => ipcRenderer.invoke("fs:get-extension", filePath),
    readDir: (folderPath: string) => ipcRenderer.invoke("fs:read-dir", folderPath),
    openSettings: () => ipcRenderer.invoke("window:open-settings"),
    closeSettings: () => ipcRenderer.invoke("window:close-settings"),
    readImageAsBase64: (filePath: string) => ipcRenderer.invoke("fs:read-image-base64", filePath),
    openNewWindow: () => ipcRenderer.invoke("window:open-new"),
    openFolder: (folderPath: string, inNewWindow: boolean) =>
        ipcRenderer.invoke("project:open-folder", folderPath, inNewWindow),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

declare global {
    interface Window {
        electronAPI: typeof electronAPI;
    }
}
