import type { Project } from "../types/project.js";
import type { Scene } from "../types/scene.js";
import { TabBar } from "./components/tabBar.js";
import { createScene } from "../types/scene.js";
import { ItemDisplayObject, GameObjectType } from "../types/gameObject.js";
import { TextDisplayObject } from "../types/gameObject.js";
import { CanvasRenderer } from "./components/canvas.js";
import { PropertyPanel } from "./components/propertyPanel.js";

let currentProject: Project | null = null;
let scenes: Map<string, Scene> = new Map();
let tabBar: TabBar | null = null;
let activeSceneId: string | null = null;
let canvasRenderer: CanvasRenderer | null = null;
let propertyPanel: PropertyPanel | null = null;

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

    // 프로젝트 데이터 로드
    await initializeEditor();

    // 탭 바 초기화
    const tabBarContainer = document.getElementById("tabBar");
    if (tabBarContainer) {
        tabBar = new TabBar(tabBarContainer, {
            onTabChange: (sceneId: string) => {
                activeSceneId = sceneId;
                canvasRenderer?.forceRender();
            },
            onTabClose: (sceneId: string) => {
                if (scenes.size <= 1) {
                    alert("최소 한 개의 Scene이 필요합니다.");
                    return;
                }
                scenes.delete(sceneId);
                tabBar?.removeTab(sceneId);
                canvasRenderer?.forceRender();
            },
            onTabAdd: () => {
                addNewScene();
            },
        });
    }

    // 기본 Scene이 없으면 하나 생성
    if (scenes.size === 0) {
        addNewScene();
    }

    // 속성 패널 초기화
    const propertyPanelContainer = document.getElementById("propertyPanel");
    if (propertyPanelContainer) {
        propertyPanel = new PropertyPanel(propertyPanelContainer);
        
        // 속성 변경 시 Canvas 업데이트
        window.addEventListener("property-changed", () => {
            canvasRenderer?.forceRender();
        });
    }

    // 툴바 버튼 이벤트
    setupToolbarButtons();
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
    const sceneId = `scene-${Date.now()}`;
    const sceneName = `Scene ${scenes.size + 1}`;
    const newScene = createScene(sceneId, { name: sceneName });
    scenes.set(sceneId, newScene);
    tabBar?.addTab(newScene);

    if (currentProject) {
        currentProject.scenes.push(newScene);
    }
}

/**
 * 툴바 버튼 이벤트를 설정합니다.
 */
function setupToolbarButtons(): void {
    const addItemDisplayBtn = document.getElementById("addItemDisplayBtn");
    const addTextDisplayBtn = document.getElementById("addTextDisplayBtn");
    const saveBtn = document.getElementById("saveBtn");
    const saveAsBtn = document.getElementById("saveAsBtn");

    addItemDisplayBtn?.addEventListener("click", () => {
        if (!activeSceneId) return;
        const scene = scenes.get(activeSceneId);
        if (!scene) return;

        const newObject = new ItemDisplayObject(`item-${Date.now()}`, {
            x: 0,
            y: 0,
        });
        scene.gameObjects.push(newObject);
        canvasRenderer?.forceRender();
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
    });

    saveBtn?.addEventListener("click", async () => {
        if (!currentProject) {
            alert("저장할 프로젝트가 없습니다.");
            return;
        }
        
        // 현재 Scene들을 프로젝트에 반영
        currentProject.scenes = Array.from(scenes.values());
        
        try {
            const { saveProject } = await import("../util/projectManager.js");
            await saveProject(currentProject);
            alert("프로젝트가 저장되었습니다.");
        } catch (error) {
            console.error("저장 실패:", error);
            alert("저장에 실패했습니다.");
        }
    });

    saveAsBtn?.addEventListener("click", async () => {
        if (!currentProject) {
            alert("저장할 프로젝트가 없습니다.");
            return;
        }
        
        // 현재 Scene들을 프로젝트에 반영
        currentProject.scenes = Array.from(scenes.values());
        
        try {
            const { saveProjectAs } = await import("../util/projectManager.js");
            await saveProjectAs(currentProject);
            alert("프로젝트가 저장되었습니다.");
        } catch (error) {
            console.error("저장 실패:", error);
            alert("저장에 실패했습니다.");
        }
    });
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
 * 프로젝트를 설정합니다.
 */
export function setProject(project: Project): void {
    currentProject = project;
    scenes.clear();

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
}

/**
 * Canvas 렌더러를 반환합니다.
 */
export function getCanvasRenderer(): CanvasRenderer | null {
    return canvasRenderer;
}

