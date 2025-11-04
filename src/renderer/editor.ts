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

/**
 * 에디터 초기화
 */
document.addEventListener("DOMContentLoaded", async () => {
    if (!window.electronAPI) {
        console.error("electronAPI가 초기화되지 않았습니다.");
        return;
    }

    // Canvas 초기화 (먼저 초기화 필요)
    const canvas = document.getElementById("editorCanvas") as HTMLCanvasElement;
    if (canvas) {
        canvasRenderer = new CanvasRenderer(canvas);
    }

    // 탭 바 초기화 (먼저 초기화)
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

    // 프로젝트 데이터 로드 (탭바 초기화 후)
    await initializeEditor();

    // 기본 Scene이 없으면 하나 생성
    if (scenes.size === 0) {
        addNewScene();
    } else {
        // 초기 상태 저장
        saveHistoryState();
    }

    // 속성 패널 초기화
    const propertyPanelContainer = document.getElementById("propertyPanel");
    if (propertyPanelContainer) {
        propertyPanel = new PropertyPanel(propertyPanelContainer);

        // 속성 변경 시 Canvas 업데이트 및 속성 패널 업데이트
        window.addEventListener("property-changed", () => {
            canvasRenderer?.forceRender();
            // 선택된 오브젝트가 있으면 속성 패널 업데이트
            const selectedObj = canvasRenderer?.getSelectedObject();
            if (selectedObj) {
                propertyPanel?.showObjectProperties(selectedObj);
            }
        });

        // 삭제 이벤트 처리
        window.addEventListener("delete-object", ((e: Event) => {
            const customEvent = e as CustomEvent<GameObject>;
            const scene = getActiveScene();
            if (scene && customEvent.detail) {
                const index = scene.gameObjects.indexOf(customEvent.detail);
                if (index >= 0) {
                    scene.gameObjects.splice(index, 1);
                    // 선택 해제 이벤트 발생
                    const event = new CustomEvent("object-selected", { detail: null });
                    window.dispatchEvent(event);
                    canvasRenderer?.forceRender();
                    saveHistoryState();
                }
            }
        }) as EventListener);
    }

    // 툴바 버튼 이벤트
    setupToolbarButtons();

    // 키보드 단축키 설정
    setupKeyboardShortcuts();

    // Scene 이름 변경 이벤트 리스너
    window.addEventListener("scene-name-changed", ((e: Event) => {
        const customEvent = e as CustomEvent<{ sceneId: string; name: string }>;
        const scene = scenes.get(customEvent.detail.sceneId);
        if (scene) {
            scene.name = customEvent.detail.name;
        }
    }) as EventListener);

    // 오브젝트 위치 변경 이벤트 리스너 (히스토리 저장)
    window.addEventListener("object-position-changed", () => {
        saveHistoryState();
    });
});

/**
 * 에디터를 초기화합니다.
 */
async function initializeEditor(): Promise<void> {
    // IPC를 통해 프로젝트 데이터 가져오기
    try {
        const projectData = await window.electronAPI.getCurrentProject?.();
        if (projectData) {
            setProject(projectData);
            return;
        }
    } catch (error) {
        console.error("프로젝트 데이터 로드 실패:", error);
    }

    // 프로젝트 데이터가 없으면 기본 프로젝트 생성
    console.warn("프로젝트 데이터가 없습니다. 기본 프로젝트를 생성합니다.");
}

/**
 * 새 Scene을 추가합니다.
 */
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

/**
 * 툴바 버튼 이벤트를 설정합니다.
 */
function setupToolbarButtons(): void {
    const addAssetBtn = document.getElementById("addAssetBtn");
    const addTextDisplayBtn = document.getElementById("addTextDisplayBtn");
    const saveBtn = document.getElementById("saveBtn");

    addAssetBtn?.addEventListener("click", async () => {
        if (!activeSceneId || !currentProject) return;
        const scene = scenes.get(activeSceneId);
        if (!scene) return;

        try {
            // 이미지 파일 선택
            const imagePath = await window.electronAPI.selectImageFile();
            if (!imagePath) return;

            // assets 폴더 생성
            const assetsFolder = `${currentProject.path}/assets`;
            await window.electronAPI.createFolder(assetsFolder);

            // 파일명 생성
            const ext = (await window.electronAPI.getFileExtension(imagePath)) || ".png";
            const fileName = `asset-${Date.now()}${ext}`;
            const destPath = `${assetsFolder}/${fileName}`;

            // 파일 복사
            await window.electronAPI.copyFile(imagePath, destPath);

            // 메타데이터 파일 생성
            const assetId = `${Date.now()}`;
            const metaPath = `${assetsFolder}/${fileName}.semeta`;
            const metaData = {
                id: assetId,
                path: `assets/${fileName}`,
                originalPath: imagePath,
                createdAt: new Date().toISOString(),
            };
            await window.electronAPI.writeProjectFile(metaPath, JSON.stringify(metaData, null, 2));

            // Asset 오브젝트 생성
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
            // 크기 속성 추가
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

/**
 * 키보드 단축키를 설정합니다.
 */
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

/**
 * 프로젝트를 저장합니다.
 */
async function saveProject(): Promise<void> {
    if (!currentProject) {
        showSaveNotification(t("editor.noProject"), "error");
        return;
    }

    showSaveNotification(t("editor.saving"), "saving");

    // 현재 Scene들을 프로젝트에 반영
    currentProject.scenes = Array.from(scenes.values());

    try {
        const { saveProject: saveProjectFn } = await import("../util/projectManager.js");
        await saveProjectFn(currentProject);
        showSaveNotification(t("editor.saved"), "success");
    } catch (error) {
        console.error("저장 실패:", error);
        showSaveNotification(t("editor.saveFailed"), "error");
    }
}

/**
 * 저장 알림을 표시합니다.
 */
function showSaveNotification(message: string, type: "saving" | "success" | "error"): void {
    let notification = document.getElementById("saveNotification");
    if (!notification) {
        notification = document.createElement("div");
        notification.id = "saveNotification";
        notification.className = "save-notification";
        document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.className = `save-notification save-notification-${type}`;
    notification.style.display = "block";
    notification.style.opacity = "1";
    notification.style.transition = "opacity 0.5s ease-out";

    if (type === "success") {
        setTimeout(() => {
            notification.style.opacity = "0";
            setTimeout(() => {
                notification.style.display = "none";
            }, 500);
        }, 2000);
    } else if (type === "error") {
        setTimeout(() => {
            notification.style.opacity = "0";
            setTimeout(() => {
                notification.style.display = "none";
            }, 500);
        }, 3000);
    }
}

/**
 * 현재 활성 Scene을 반환합니다.
 */
export function getActiveScene(): Scene | null {
    if (!activeSceneId) return null;
    return scenes.get(activeSceneId) ?? null;
}

/**
 * 모든 Scene을 반환합니다.
 */
export function getAllScenes(): Scene[] {
    return Array.from(scenes.values());
}

/**
 * 히스토리 상태를 저장합니다.
 */
function saveHistoryState(): void {
    const currentScenes = Array.from(scenes.values());
    historyManager.pushState(currentScenes);
    updateUndoRedoButtons();
}

/**
 * Undo를 수행합니다.
 */
function performUndo(): void {
    if (!historyManager.canUndo()) return;

    const state = historyManager.undo();
    if (state) {
        applyHistoryState(state);
    }
}

/**
 * Redo를 수행합니다.
 */
function performRedo(): void {
    if (!historyManager.canRedo()) return;

    const state = historyManager.redo();
    if (state) {
        applyHistoryState(state);
    }
}

/**
 * 히스토리 상태를 적용합니다.
 */
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

/**
 * Undo/Redo 버튼 상태를 업데이트합니다.
 */
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

/**
 * 프로젝트를 설정합니다.
 */
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
            canvasRenderer?.forceRender();
        }
    }

    // 초기 상태 저장
    saveHistoryState();
}

/**
 * Canvas 렌더러를 반환합니다.
 */
export function getCanvasRenderer(): CanvasRenderer | null {
    return canvasRenderer;
}

/**
 * 현재 프로젝트를 반환합니다.
 */
export function getCurrentProject(): Project | null {
    return currentProject;
}
