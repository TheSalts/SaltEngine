import type { Project, AspectRatio } from "../types/project.js";
import type { Scene } from "../types/scene.js";
import { createProject } from "../types/project.js";

let projectPath: string | null = null;
let datapackPath: string | null = null;
let resourcepackPath: string | null = null;
let projectName: string = "";

/**
 * 웰컴 스크린 초기화
 */
document.addEventListener("DOMContentLoaded", () => {
    const projectNameInput = document.getElementById("projectName") as HTMLInputElement;
    const openProjectBtn = document.getElementById("openProjectBtn");
    const newProjectBtn = document.getElementById("newProjectBtn");
    const modal = document.getElementById("newProjectModal");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const createProjectBtn = document.getElementById("createProjectBtn");
    const selectProjectPathBtn = document.getElementById("selectProjectPathBtn");
    const selectDatapackPathBtn = document.getElementById("selectDatapackPathBtn");
    const selectResourcepackPathBtn = document.getElementById("selectResourcepackPathBtn");
    const useExistingPathsCheckbox = document.getElementById("useExistingPaths") as HTMLInputElement;
    const settingsBtn = document.getElementById("settingsBtn");

    if (!window.electronAPI) {
        console.error("electronAPI가 초기화되지 않았습니다.");
        return;
    }

    projectNameInput.addEventListener("input", (event) => {
        projectName = (event.target as HTMLInputElement).value ?? "project";
        if (projectPath) {
            setProjectPath(projectPath.substring(0, projectPath.lastIndexOf("/") + 1) + projectName);
        }
    });

    // 프로젝트 열기 버튼
    openProjectBtn?.addEventListener("click", async () => {
        try {
            const folderPath = await window.electronAPI.selectFolder("프로젝트 폴더 선택");
            if (folderPath) {
                await loadProjectFromFolder(folderPath);
            }
        } catch (error) {
            console.error("프로젝트 열기 실패:", error);
            alert("프로젝트를 열 수 없습니다.");
        }
    });

    // 새 프로젝트 버튼
    newProjectBtn?.addEventListener("click", () => {
        modal?.classList.remove("hidden");
    });

    // 모달 닫기
    closeModalBtn?.addEventListener("click", () => {
        modal?.classList.add("hidden");
        resetForm();
    });

    cancelBtn?.addEventListener("click", () => {
        modal?.classList.add("hidden");
        resetForm();
    });

    // 프로젝트 경로 선택
    selectProjectPathBtn?.addEventListener("click", async () => {
        try {
            const path = await window.electronAPI.selectFolder("프로젝트 폴더 선택");
            if (path) setProjectPath(path + "/" + (projectName || "project"));
        } catch (error) {
            console.error("폴더 선택 실패:", error);
        }
    });

    // Datapack 경로 선택
    selectDatapackPathBtn?.addEventListener("click", async () => {
        try {
            const path = await window.electronAPI.selectFolder("Datapack 폴더 선택");
            if (path) {
                datapackPath = path;
                const input = document.getElementById("datapackPath") as HTMLInputElement;
                if (input) {
                    input.value = path;
                }
            }
        } catch (error) {
            console.error("폴더 선택 실패:", error);
        }
    });

    // Resourcepack 경로 선택
    selectResourcepackPathBtn?.addEventListener("click", async () => {
        try {
            const path = await window.electronAPI.selectFolder("Resourcepack 폴더 선택");
            if (path) {
                resourcepackPath = path;
                const input = document.getElementById("resourcepackPath") as HTMLInputElement;
                if (input) {
                    input.value = path;
                }
            }
        } catch (error) {
            console.error("폴더 선택 실패:", error);
        }
    });

    // 프로젝트 생성
    createProjectBtn?.addEventListener("click", async () => {
        if (!projectPath) {
            alert("프로젝트 경로를 선택해주세요.");
            return;
        }
        const aspectRatioSelect = document.getElementById("aspectRatio") as HTMLSelectElement;
        const aspectRatio = (aspectRatioSelect?.value ?? "16:9") as AspectRatio;
        const minecraftVersionSelect = document.getElementById("minecraftVersion") as HTMLSelectElement;
        const minecraftVersion = minecraftVersionSelect?.value ?? "1.21.8";

        let finalDatapackPath: string;
        let finalResourcepackPath: string;

        // 프로젝트 경로 내에 폴더 생성
        finalDatapackPath = datapackPath ? datapackPath : `${projectPath}/saltengine_dp`;
        finalResourcepackPath = resourcepackPath ? resourcepackPath : `${projectPath}/saltengine_rp`;

        try {
            await window.electronAPI.createFolder(finalDatapackPath);
            await window.electronAPI.createFolder(finalResourcepackPath);
        } catch (error) {
            console.error("폴더 생성 실패:", error);
            alert("폴더 생성에 실패했습니다.");
            return;
        }

        const project = createProject({
            name: projectName,
            path: projectPath,
            datapackPath: finalDatapackPath,
            resourcepackPath: finalResourcepackPath,
            aspectRatio,
            minecraftVersion,
        });

        await switchToEditor(project);
    });

    // 설정 버튼
    settingsBtn?.addEventListener("click", () => {
        window.electronAPI.openSettings?.();
    });
});

function setProjectPath(path: string): string {
    const input = document.getElementById("projectPath") as HTMLInputElement;
    if (input) {
        input.value = path;
    }
    return (projectPath = path);
}

/**
 * 폴더에서 프로젝트를 로드합니다.
 */
async function loadProjectFromFolder(folderPath: string): Promise<void> {
    try {
        // 폴더 내에서 .salt.json 파일 찾기
        const projectFiles = await window.electronAPI.findProjectFiles(folderPath);
        if (!projectFiles || projectFiles.length === 0) {
            alert("프로젝트 파일(.salt.json)을 찾을 수 없습니다.");
            return;
        }

        // 첫 번째 프로젝트 파일 로드
        const projectFilePath = projectFiles[0];
        const data = await window.electronAPI.readProjectFile(projectFilePath);

        // scenes 폴더에서 Scene 파일들 로드
        const scenesFolder = `${folderPath}/scenes`;
        const sceneFiles = await window.electronAPI.readDir(scenesFolder);
        const scenes: Scene[] = [];

        for (const sceneFile of sceneFiles) {
            if (sceneFile.endsWith(".json")) {
                try {
                    const sceneData = await window.electronAPI.readProjectFile(sceneFile);
                    scenes.push(sceneData as Scene);
                } catch (error) {
                    console.error(`Scene 파일 로드 실패: ${sceneFile}`, error);
                }
            }
        }

        const project: Project = {
            name: data.name,
            path: folderPath,
            datapackPath: data.datapackPath ?? data.metadata?.datapackPath ?? "",
            resourcepackPath: data.resourcepackPath ?? data.metadata?.resourcepackPath ?? "",
            aspectRatio: data.aspectRatio,
            minecraftVersion: data.minecraftVersion ?? "1.21.8",
            scenes: scenes,
        };
        await switchToEditor(project);
    } catch (error) {
        console.error("프로젝트 로드 실패:", error);
        alert("프로젝트를 불러올 수 없습니다.");
    }
}

/**
 * 에디터 뷰로 전환합니다.
 */
async function switchToEditor(project: Project): Promise<void> {
    try {
        await window.electronAPI.switchToEditor(project);
    } catch (error) {
        console.error("에디터 전환 실패:", error);
        alert("에디터를 열 수 없습니다.");
    }
}

/**
 * 폼을 초기화합니다.
 */
function resetForm(): void {
    projectPath = null;
    datapackPath = null;
    resourcepackPath = null;

    const projectPathInput = document.getElementById("projectPath") as HTMLInputElement;
    const datapackPathInput = document.getElementById("datapackPath") as HTMLInputElement;
    const resourcepackPathInput = document.getElementById("resourcepackPath") as HTMLInputElement;
    const useExistingPathsCheckbox = document.getElementById("useExistingPaths") as HTMLInputElement;
    const pathOptions = document.getElementById("pathOptions");

    if (projectPathInput) projectPathInput.value = "";
    if (datapackPathInput) datapackPathInput.value = "";
    if (resourcepackPathInput) resourcepackPathInput.value = "";
    if (useExistingPathsCheckbox) useExistingPathsCheckbox.checked = false;
    if (pathOptions) pathOptions.classList.add("hidden");
}
