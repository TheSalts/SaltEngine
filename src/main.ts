import { app, BrowserWindow, ipcMain } from "electron";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { registerProjectIpcHandlers } from "./ipc/projectIpc.js";

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
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

    // 창 닫기 전 저장 처리
    mainWindow.on("close", async (e) => {
        if (mainWindow) {
            e.preventDefault();
            
            try {
                // 렌더러 프로세스에 저장 요청
                await mainWindow.webContents.executeJavaScript(`
                    (async () => {
                        if (window.hasUnsavedChanges && window.emergencySave) {
                            await window.emergencySave();
                        }
                    })()
                `);
            } catch (error) {
                console.error("저장 중 오류:", error);
            }

            // 저장 완료 후 창 닫기
            mainWindow.destroy();
            mainWindow = null;
        }
    });
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

    // 설정 창 열기
    ipcMain.handle("window:open-settings", (_event: unknown) => {
        if (settingsWindow) {
            settingsWindow.focus();
            return;
        }

        const windowOptions: Electron.BrowserWindowConstructorOptions = {
            width: 600,
            height: 500,
            modal: true,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: join(__dirname, "preload.js"),
            },
        };

        if (mainWindow) {
            windowOptions.parent = mainWindow;
        }

        settingsWindow = new BrowserWindow(windowOptions);

        const projectRoot = resolve(__dirname, "..");
        const settingsPath = resolve(projectRoot, "src/renderer/settings.html");
        settingsWindow.loadURL(pathToFileURL(settingsPath).href);

        settingsWindow.on("closed", () => {
            settingsWindow = null;
        });
    });

    // 설정 창 닫기
    ipcMain.handle("window:close-settings", (_event: unknown) => {
        if (settingsWindow) {
            settingsWindow.close();
            settingsWindow = null;
        }
    });

    // 새 창 열기
    ipcMain.handle("window:open-new", (_event: unknown) => {
        const newWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: join(__dirname, "preload.js"),
            },
        });

        const projectRoot = resolve(__dirname, "..");
        const welcomePath = resolve(projectRoot, "src/renderer/welcome.html");
        newWindow.loadURL(pathToFileURL(welcomePath).href);

        return true;
    });

    // 폴더 열기 (프로젝트 로드)
    ipcMain.handle("project:open-folder", async (_event: unknown, folderPath: string, inNewWindow: boolean) => {
        try {
            // 프로젝트 파일 찾기
            const fs = await import("node:fs/promises");
            const path = await import("node:path");
            
            const files = await fs.readdir(folderPath);
            const projectFiles = files.filter((file: string) => file.endsWith(".seproj"));
            
            if (projectFiles.length === 0) {
                throw new Error("프로젝트 파일을 찾을 수 없습니다.");
            }

            // 첫 번째 프로젝트 파일 읽기
            const projectFilePath = path.join(folderPath, projectFiles[0] as string);
            const projectData = JSON.parse(await fs.readFile(projectFilePath, "utf-8"));

            if (inNewWindow) {
                // 새 창에서 열기
                const newWindow = new BrowserWindow({
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
                
                // 새 창의 프로젝트 데이터 설정
                newWindow.webContents.once("did-finish-load", () => {
                    newWindow.webContents.send("project:load", projectData);
                });
                
                newWindow.loadURL(pathToFileURL(editorPath).href);
            } else {
                // 현재 창에서 열기
                currentProject = projectData;
                createEditorWindow(projectData);
            }

            return { success: true, projectData };
        } catch (error) {
            console.error("폴더 열기 실패:", error);
            return { success: false, error: (error as Error).message };
        }
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
