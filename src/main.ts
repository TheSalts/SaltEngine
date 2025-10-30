import { app, BrowserWindow, ipcMain } from "electron";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { registerProjectIpcHandlers } from "./ipc/projectIpc.js";

let mainWindow: BrowserWindow | null = null;
let currentProject: unknown = null;

// ES Modules에서 __dirname 사용을 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 웰컴 스크린을 표시합니다.
 */
function createWelcomeWindow(): void {
    if (mainWindow) {
        mainWindow.destroy();
    }

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: join(__dirname, "preload.js"),
        },
    });

    const projectRoot = resolve(__dirname, "..");
    const welcomePath = resolve(projectRoot, "src/renderer/welcome.html");
    mainWindow.loadURL(pathToFileURL(welcomePath).href);
}

/**
 * 에디터 뷰를 표시합니다.
 */
function createEditorWindow(projectData: unknown): void {
    if (mainWindow) {
        mainWindow.destroy();
    }

    currentProject = projectData;

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: join(__dirname, "preload.js"),
        },
    });

    const projectRoot = resolve(__dirname, "..");
    const editorPath = resolve(projectRoot, "src/renderer/editor.html");
    mainWindow.loadURL(pathToFileURL(editorPath).href);
}

app.on("ready", () => {
    // IPC 핸들러 등록
    registerProjectIpcHandlers();

    // 에디터로 전환
    ipcMain.handle("window:switch-to-editor", (_event: unknown, projectData: unknown) => {
        currentProject = projectData;
        createEditorWindow(projectData);
        return true;
    });

    // 현재 프로젝트 데이터 가져오기
    ipcMain.handle("project:get-current", (_event: unknown) => {
        return currentProject;
    });

    // 웰컴 화면으로 전환
    ipcMain.handle("window:switch-to-welcome", (_event: unknown) => {
        currentProject = null;
        createWelcomeWindow();
        return true;
    });

    // 초기 화면은 웰컴 스크린
    createWelcomeWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWelcomeWindow();
    }
});
