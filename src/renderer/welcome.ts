import type { Project, AspectRatio } from "../types/project.js";
import { createProject } from "../types/project.js";

let projectPath: string | null = null;
let datapackPath: string | null = null;
let resourcepackPath: string | null = null;
let projectName: string = "";

/**
 * 웰컴 스크린 초기화
 */
document.addEventListener("DOMContentLoaded", () => {
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
    const pathOptions = document.getElementById("pathOptions");

    if (!window.electronAPI) {
        console.error("electronAPI가 초기화되지 않았습니다.");
        return;
    }

    // 프로젝트 열기 버튼
    openProjectBtn?.addEventListener("click", async () => {
        try {
            const filePath = await window.electronAPI.openProjectDialog();
            if (filePath) {
                await loadProject(filePath);
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

    // 기존 경로 사용 체크박스
    useExistingPathsCheckbox?.addEventListener("change", (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        if (pathOptions) {
            if (checked) {
                pathOptions.classList.remove("hidden");
            } else {
                pathOptions.classList.add("hidden");
            }
        }
    });

    // 프로젝트 경로 선택
    selectProjectPathBtn?.addEventListener("click", async () => {
        try {
            const path = await window.electronAPI.selectFolder("프로젝트 폴더 선택");
            if (path) {
                projectPath = path;
                const input = document.getElementById("projectPath") as HTMLInputElement;
                if (input) {
                    input.value = path;
                }
            }
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
        let name = document.getElementById("projectName") as HTMLInputElement;
        projectName = name.value ?? "project";

        const useExistingPaths = useExistingPathsCheckbox?.checked ?? false;
        const aspectRatioSelect = document.getElementById("aspectRatio") as HTMLSelectElement;
        const aspectRatio = (aspectRatioSelect?.value ?? "16:9") as AspectRatio;

        let finalDatapackPath: string;
        let finalResourcepackPath: string;

        if (useExistingPaths) {
            if (!datapackPath || !resourcepackPath) {
                alert("datapack과 resourcepack 경로를 모두 선택해주세요.");
                return;
            }
            finalDatapackPath = datapackPath;
            finalResourcepackPath = resourcepackPath;
        } else {
            // 프로젝트 경로 내에 폴더 생성
            finalDatapackPath = `${projectPath}/datapack`;
            finalResourcepackPath = `${projectPath}/resourcepack`;

            try {
                await window.electronAPI.createFolder(finalDatapackPath);
                await window.electronAPI.createFolder(finalResourcepackPath);
            } catch (error) {
                console.error("폴더 생성 실패:", error);
                alert("폴더 생성에 실패했습니다.");
                return;
            }
        }

        const project = createProject({
            name: projectName,
            path: projectPath,
            datapackPath: finalDatapackPath,
            resourcepackPath: finalResourcepackPath,
            aspectRatio,
        });

        await switchToEditor(project);
    });
});

/**
 * 프로젝트 파일을 로드합니다.
 */
async function loadProject(filePath: string): Promise<void> {
    try {
        const data = await window.electronAPI.readProjectFile(filePath);
        const project: Project = {
            name: data.name,
            path: filePath.replace(/\.salt\.json$/, ""),
            datapackPath: data.metadata?.datapackPath ?? "",
            resourcepackPath: data.metadata?.resourcepackPath ?? "",
            aspectRatio: data.aspectRatio,
            scenes: data.scenes,
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
