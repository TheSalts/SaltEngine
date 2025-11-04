import { contextBridge, ipcRenderer } from "electron";

/**
 * Electron API 브릿지
 * 렌더러 프로세스에서 안전하게 IPC 통신을 할 수 있도록 합니다.
 */
const electronAPI = {
    /**
     * 프로젝트 열기 다이얼로그 표시
     */
    openProjectDialog: () => ipcRenderer.invoke("project:open-dialog"),

    /**
     * 프로젝트 저장 다이얼로그 표시
     */
    saveProjectDialog: (defaultPath?: string) =>
        ipcRenderer.invoke("project:save-dialog", defaultPath),

    /**
     * 프로젝트 파일 읽기
     */
    readProjectFile: (filePath: string) =>
        ipcRenderer.invoke("project:read-file", filePath),

    /**
     * 프로젝트 파일 저장
     */
    writeProjectFile: (filePath: string, data: string) =>
        ipcRenderer.invoke("project:write-file", filePath, data),

    /**
     * 폴더 선택 다이얼로그 표시
     */
    selectFolder: (title: string) =>
        ipcRenderer.invoke("dialog:select-folder", title),

    /**
     * 폴더 생성
     */
    createFolder: (folderPath: string) =>
        ipcRenderer.invoke("fs:create-folder", folderPath),

    /**
     * 폴더 존재 여부 확인
     */
    folderExists: (folderPath: string) =>
        ipcRenderer.invoke("fs:folder-exists", folderPath),

    /**
     * 에디터 뷰로 전환
     */
    switchToEditor: (projectData: unknown) =>
        ipcRenderer.invoke("window:switch-to-editor", projectData),

    /**
     * 웰컴 화면으로 전환
     */
    switchToWelcome: () => ipcRenderer.invoke("window:switch-to-welcome"),

    /**
     * 현재 프로젝트 데이터 가져오기
     */
    getCurrentProject: () => ipcRenderer.invoke("project:get-current"),

    /**
     * 폴더 내에서 프로젝트 파일 찾기
     */
    findProjectFiles: (folderPath: string) =>
        ipcRenderer.invoke("project:find-files", folderPath),

    /**
     * 이미지 파일 선택
     */
    selectImageFile: () => ipcRenderer.invoke("asset:select-image"),

    /**
     * 파일 복사
     */
    copyFile: (sourcePath: string, destPath: string) =>
        ipcRenderer.invoke("fs:copy-file", sourcePath, destPath),

    /**
     * 파일 확장자 가져오기
     */
    getFileExtension: (filePath: string) =>
        ipcRenderer.invoke("fs:get-extension", filePath),

    /**
     * 폴더 내의 모든 파일 읽기
     */
    readDir: (folderPath: string) =>
        ipcRenderer.invoke("fs:read-dir", folderPath),

    /**
     * 설정 창 열기
     */
    openSettings: () => ipcRenderer.invoke("window:open-settings"),

    /**
     * 설정 창 닫기
     */
    closeSettings: () => ipcRenderer.invoke("window:close-settings"),

    /**
     * 이미지 파일을 base64로 읽기
     */
    readImageAsBase64: (filePath: string) =>
        ipcRenderer.invoke("fs:read-image-base64", filePath),

    /**
     * 새 창 열기
     */
    openNewWindow: () => ipcRenderer.invoke("window:open-new"),

    /**
     * 폴더 열기 (프로젝트 로드)
     */
    openFolder: (folderPath: string, inNewWindow: boolean) =>
        ipcRenderer.invoke("project:open-folder", folderPath, inNewWindow),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

/**
 * TypeScript 타입 정의를 위한 전역 타입 선언
 */
declare global {
    interface Window {
        electronAPI: typeof electronAPI;
    }
}

