import type { Project } from "../types/project.js";
import type { Scene } from "../types/scene.js";
import type { GameObject } from "../types/gameObject.js";
import { TabBar } from "./components/tabBar.js";
import { createScene } from "../types/scene.js";
import { AssetObject, GameObjectType } from "../types/gameObject.js";
import { TextDisplayObject } from "../types/gameObject.js";
import { CanvasRenderer } from "./components/canvas.js";
import { PropertyPanel } from "./components/propertyPanel.js";
import { t } from "../util/i18n.js";
import { HistoryManager } from "../util/history.js";

let currentProject: Project | null = null;
let scenes: Map<string, Scene> = new Map();
let tabBar: TabBar | null = null;
let activeSceneId: string | null = null;
let canvasRenderer: CanvasRenderer | null = null;
let propertyPanel: PropertyPanel | null = null;
let historyManager: HistoryManager = new HistoryManager();
let autoSaveTimer: NodeJS.Timeout | null = null;
let hasUnsavedChanges: boolean = false;
let autoSaveInterval: number = 30000; // 30초

document.addEventListener("DOMContentLoaded", async () => {
    if (!window.electronAPI) {
        console.error("electronAPI가 초기화되지 않았습니다.");
        return;
    }

    const canvas = document.getElementById("editorCanvas") as HTMLCanvasElement;
    if (canvas) {
        canvasRenderer = new CanvasRenderer(canvas);
    }

    const tabBarContainer = document.getElementById("tabBar");
    if (tabBarContainer) {
        tabBar = new TabBar(tabBarContainer, {
            onTabChange: (sceneId: string) => {
                activeSceneId = sceneId;
                canvasRenderer?.forceRender();
            },
            onTabClose: (sceneId: string) => {
                if (scenes.size <= 1) {
                    alert(t("editor.minSceneRequired"));
                    return;
                }
                scenes.delete(sceneId);
                tabBar?.removeTab(sceneId);
                canvasRenderer?.forceRender();
                saveHistoryState();
            },
            onTabAdd: () => {
                addNewScene();
            },
        });
    }

    await initializeEditor();

    if (scenes.size === 0) {
        addNewScene();
    } else {
        saveHistoryState();
    }

    const propertyPanelContainer = document.getElementById("propertyPanel");
    if (propertyPanelContainer) {
        propertyPanel = new PropertyPanel(propertyPanelContainer);

        window.addEventListener("property-changed", () => {
            canvasRenderer?.forceRender();

            const selectedObj = canvasRenderer?.getSelectedObject();
            if (selectedObj) {
                propertyPanel?.showObjectProperties(selectedObj);
            }
        });

        window.addEventListener("delete-object", ((e: Event) => {
            const customEvent = e as CustomEvent<GameObject>;
            const scene = getActiveScene();
            if (scene && customEvent.detail) {
                const index = scene.gameObjects.indexOf(customEvent.detail);
                if (index >= 0) {
                    scene.gameObjects.splice(index, 1);

                    const event = new CustomEvent("object-selected", { detail: null });
                    window.dispatchEvent(event);
                    canvasRenderer?.forceRender();
                    saveHistoryState();
                }
            }
        }) as EventListener);
    }

    setupToolbarButtons();

    setupKeyboardShortcuts();

    window.addEventListener("scene-name-changed", ((e: Event) => {
        const customEvent = e as CustomEvent<{ sceneId: string; name: string }>;
        const scene = scenes.get(customEvent.detail.sceneId);
        if (scene) {
            scene.name = customEvent.detail.name;
        }
    }) as EventListener);

    window.addEventListener("object-position-changed", () => {
        saveHistoryState();
    });

    startAutoSave();

    setupBeforeUnloadHandler();
});

async function initializeEditor(): Promise<void> {
    try {
        const projectData = await window.electronAPI.getCurrentProject?.();
        if (projectData) {
            setProject(projectData);
            return;
        }
    } catch (error) {
        console.error("프로젝트 데이터 로드 실패:", error);
    }

    console.warn("프로젝트 데이터가 없습니다. 기본 프로젝트를 생성합니다.");
}

function addNewScene(): void {
    const sceneId = `${Date.now()}`;
    const sceneName = `Scene ${scenes.size + 1}`;
    const newScene = createScene(sceneId, { name: sceneName });
    scenes.set(sceneId, newScene);
    tabBar?.addTab(newScene);

    if (currentProject) {
        currentProject.scenes.push(newScene);
    }

    saveHistoryState();
}

function setupToolbarButtons(): void {
    const newWindowBtn = document.getElementById("newWindowBtn");
    const openFolderBtn = document.getElementById("openFolderBtn");
    const addAssetBtn = document.getElementById("addAssetBtn");
    const addTextDisplayBtn = document.getElementById("addTextDisplayBtn");
    const saveBtn = document.getElementById("saveBtn");

    newWindowBtn?.addEventListener("click", async () => {
        try {
            await window.electronAPI.openNewWindow();
        } catch (error) {
            console.error("새 창 열기 실패:", error);
            alert("새 창 열기에 실패했습니다.");
        }
    });

    openFolderBtn?.addEventListener("click", async () => {
        try {
            const folderPath = await window.electronAPI.selectFolder("프로젝트 폴더 선택");
            if (!folderPath) return;

            showOpenFolderModal(folderPath);
        } catch (error) {
            console.error("폴더 열기 실패:", error);
            alert("폴더 열기에 실패했습니다.");
        }
    });

    addAssetBtn?.addEventListener("click", async () => {
        if (!activeSceneId || !currentProject) return;
        const scene = scenes.get(activeSceneId);
        if (!scene) return;

        try {
            const imagePath = await window.electronAPI.selectImageFile();
            if (!imagePath) return;

            const assetsFolder = `${currentProject.path}/assets`;
            await window.electronAPI.createFolder(assetsFolder);

            const ext = (await window.electronAPI.getFileExtension(imagePath)) || ".png";
            const fileName = `asset-${Date.now()}${ext}`;
            const destPath = `${assetsFolder}/${fileName}`;

            await window.electronAPI.copyFile(imagePath, destPath);

            const assetId = `${Date.now()}`;
            const metaPath = `${assetsFolder}/${fileName}.semeta`;
            const metaData = {
                id: assetId,
                path: `assets/${fileName}`,
                originalPath: imagePath,
                createdAt: new Date().toISOString(),
            };
            await window.electronAPI.writeProjectFile(metaPath, JSON.stringify(metaData, null, 2));

            const newObject = new AssetObject(
                assetId,
                {
                    x: 0,
                    y: 0,
                },
                0,
                { x: 1, y: 1 },
                {
                    assetPath: `assets/${fileName}`,
                }
            );

            (newObject as any).width = 40;
            (newObject as any).height = 40;
            scene.gameObjects.push(newObject);
            canvasRenderer?.forceRender();
            saveHistoryState();
        } catch (error) {
            console.error("Asset 추가 실패:", error);
            alert("Asset 추가에 실패했습니다.");
        }
    });

    addTextDisplayBtn?.addEventListener("click", () => {
        if (!activeSceneId) return;
        const scene = scenes.get(activeSceneId);
        if (!scene) return;

        const newObject = new TextDisplayObject(`text-${Date.now()}`, {
            x: 0,
            y: 0,
        });
        scene.gameObjects.push(newObject);
        canvasRenderer?.forceRender();
        saveHistoryState();
    });

    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");

    undoBtn?.addEventListener("click", () => {
        performUndo();
    });

    redoBtn?.addEventListener("click", () => {
        performRedo();
    });

    saveBtn?.addEventListener("click", async () => {
        await saveProject();
    });

    const settingsBtn = document.getElementById("settingsBtn");
    settingsBtn?.addEventListener("click", () => {
        window.electronAPI.openSettings?.();
    });
}

function setupKeyboardShortcuts(): void {
    document.addEventListener("keydown", async (e: KeyboardEvent) => {
        const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
        const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
        const shift = e.shiftKey;
        const option = e.altKey;

        if (ctrlOrCmd && e.key === "s") {
            e.preventDefault();
            await saveProject();
        } else if (ctrlOrCmd && e.key === "z" && !shift && !option) {
            e.preventDefault();
            performUndo();
        } else if (ctrlOrCmd && e.key === "z" && (shift || (isMac && option))) {
            e.preventDefault();
            performRedo();
        }
    });
}

async function saveProject(): Promise<void> {
    if (!currentProject) {
        showSaveNotification(t("editor.noProject"), "error");
        return;
    }

    showSaveNotification(t("editor.saving"), "saving");

    currentProject.scenes = Array.from(scenes.values());

    try {
        const { saveProject: saveProjectFn } = await import("../util/projectManager.js");
        await saveProjectFn(currentProject);
        hasUnsavedChanges = false;
        showSaveNotification(t("editor.saved"), "success");
    } catch (error) {
        console.error("저장 실패:", error);
        showSaveNotification(t("editor.saveFailed"), "error");
    }
}

function showSaveNotification(message: string, type: "saving" | "success" | "error"): void {
    const saveStatus = document.getElementById("saveStatus");
    if (!saveStatus) return;

    saveStatus.className = "save-status visible";

    saveStatus.classList.add(type);
    saveStatus.textContent = message;

    if (type === "success") {
        setTimeout(() => {
            saveStatus.classList.remove("visible");
        }, 3000);
    } else if (type === "error") {
        setTimeout(() => {
            saveStatus.classList.remove("visible");
        }, 5000);
    }
}

export function getActiveScene(): Scene | null {
    if (!activeSceneId) return null;
    return scenes.get(activeSceneId) ?? null;
}

export function getAllScenes(): Scene[] {
    return Array.from(scenes.values());
}

function saveHistoryState(): void {
    const currentScenes = Array.from(scenes.values());
    historyManager.pushState(currentScenes);
    updateUndoRedoButtons();
    markAsChanged();
}

function performUndo(): void {
    if (!historyManager.canUndo()) return;

    const state = historyManager.undo();
    if (state) {
        applyHistoryState(state);
    }
}

function performRedo(): void {
    if (!historyManager.canRedo()) return;

    const state = historyManager.redo();
    if (state) {
        applyHistoryState(state);
    }
}

function applyHistoryState(state: { scenes: Scene[] }): void {
    scenes.clear();
    tabBar?.removeAllTabs();

    for (const scene of state.scenes) {
        scenes.set(scene.id, scene);
        tabBar?.addTab(scene);
    }

    if (scenes.size > 0 && tabBar) {
        const firstSceneId = Array.from(scenes.keys())[0];
        if (firstSceneId) {
            tabBar.setActiveTab(firstSceneId);
            activeSceneId = firstSceneId;
        }
    }

    canvasRenderer?.forceRender();
    updateUndoRedoButtons();
}

function updateUndoRedoButtons(): void {
    const undoBtn = document.getElementById("undoBtn") as HTMLButtonElement | null;
    const redoBtn = document.getElementById("redoBtn") as HTMLButtonElement | null;

    if (undoBtn) {
        undoBtn.disabled = !historyManager.canUndo();
    }
    if (redoBtn) {
        redoBtn.disabled = !historyManager.canRedo();
    }
}

export function setProject(project: Project): void {
    currentProject = project;
    scenes.clear();
    historyManager.clear();

    for (const scene of project.scenes) {
        scenes.set(scene.id, scene);
        tabBar?.addTab(scene);
    }

    if (scenes.size > 0 && tabBar) {
        const firstSceneId = Array.from(scenes.keys())[0];
        if (firstSceneId) {
            tabBar.setActiveTab(firstSceneId);

            canvasRenderer?.fitWorkspaceToView();
            canvasRenderer?.forceRender();
        }
    }

    saveHistoryState();
}

export function getCanvasRenderer(): CanvasRenderer | null {
    return canvasRenderer;
}

export function getCurrentProject(): Project | null {
    return currentProject;
}

function markAsChanged(): void {
    hasUnsavedChanges = true;
}

function startAutoSave(): void {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }

    autoSaveTimer = setInterval(() => {
        autoSaveProject();
    }, autoSaveInterval);
}

function stopAutoSave(): void {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
}

async function autoSaveProject(): Promise<void> {
    if (!currentProject || !hasUnsavedChanges) {
        return;
    }

    currentProject.scenes = Array.from(scenes.values());

    try {
        const { saveProject: saveProjectFn } = await import("../util/projectManager.js");
        await saveProjectFn(currentProject);
        hasUnsavedChanges = false;
        showSaveNotification("자동 저장됨", "success");
    } catch (error) {
        console.error("자동 저장 실패:", error);
    }
}

function setupBeforeUnloadHandler(): void {
    window.addEventListener("beforeunload", async (e) => {
        if (hasUnsavedChanges && currentProject) {
            e.preventDefault();
            await emergencySave();
        }
    });

    window.addEventListener("unload", async () => {
        if (hasUnsavedChanges && currentProject) {
            await emergencySave();
        }
    });

    document.addEventListener("visibilitychange", async () => {
        if (document.hidden && hasUnsavedChanges && currentProject) {
            await emergencySave();
        }
    });
}

async function emergencySave(): Promise<void> {
    if (!currentProject) return;

    currentProject.scenes = Array.from(scenes.values());

    try {
        const { saveProject: saveProjectFn } = await import("../util/projectManager.js");
        await saveProjectFn(currentProject);
        hasUnsavedChanges = false;
        console.log("긴급 저장 완료");
    } catch (error) {
        console.error("긴급 저장 실패:", error);
    }
}

function showOpenFolderModal(folderPath: string): void {
    const modal = document.getElementById("openFolderModal");
    if (!modal) return;

    modal.classList.add("show");

    const openInNewWindowBtn = document.getElementById("openInNewWindowBtn");
    const newWindowHandler = async () => {
        try {
            await window.electronAPI.openFolder(folderPath, true);
            modal.classList.remove("show");
            cleanup();
        } catch (error) {
            console.error("폴더 열기 실패:", error);
            alert("폴더 열기에 실패했습니다.");
        }
    };

    const openInCurrentWindowBtn = document.getElementById("openInCurrentWindowBtn");
    const currentWindowHandler = async () => {
        try {
            await window.electronAPI.openFolder(folderPath, false);
            modal.classList.remove("show");
            cleanup();
        } catch (error) {
            console.error("폴더 열기 실패:", error);
            alert("폴더 열기에 실패했습니다.");
        }
    };

    const cancelBtn = document.getElementById("cancelOpenFolderBtn");
    const cancelHandler = () => {
        modal.classList.remove("show");
        cleanup();
    };

    const cleanup = () => {
        openInNewWindowBtn?.removeEventListener("click", newWindowHandler);
        openInCurrentWindowBtn?.removeEventListener("click", currentWindowHandler);
        cancelBtn?.removeEventListener("click", cancelHandler);
        modal.removeEventListener("click", outsideClickHandler);
    };

    const outsideClickHandler = (e: MouseEvent) => {
        if (e.target === modal) {
            modal.classList.remove("show");
            cleanup();
        }
    };

    openInNewWindowBtn?.addEventListener("click", newWindowHandler);
    openInCurrentWindowBtn?.addEventListener("click", currentWindowHandler);
    cancelBtn?.addEventListener("click", cancelHandler);
    modal.addEventListener("click", outsideClickHandler);
}

(window as any).emergencySave = emergencySave;
Object.defineProperty(window, "hasUnsavedChanges", {
    get: () => hasUnsavedChanges,
});
