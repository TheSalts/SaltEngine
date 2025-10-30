import type { Project } from "../types/project.js";
import { serializeProject } from "./fileSystem.js";

/**
 * 프로젝트 파일을 저장합니다.
 */
export async function saveProject(project: Project): Promise<boolean> {
    if (!window.electronAPI) {
        throw new Error("electronAPI가 초기화되지 않았습니다.");
    }

    try {
        const filePath = `${project.path}/${project.name}.salt.json`;
        const serialized = serializeProject(project);
        await window.electronAPI.writeProjectFile(filePath, serialized);
        return true;
    } catch (error) {
        console.error("프로젝트 저장 실패:", error);
        throw error;
    }
}

/**
 * 프로젝트 파일을 저장할 경로를 선택하고 저장합니다.
 */
export async function saveProjectAs(project: Project): Promise<boolean> {
    if (!window.electronAPI) {
        throw new Error("electronAPI가 초기화되지 않았습니다.");
    }

    try {
        const defaultPath = `${project.path}/${project.name}.salt.json`;
        const filePath = await window.electronAPI.saveProjectDialog(defaultPath);
        if (!filePath) {
            return false;
        }

        const serialized = serializeProject(project);
        await window.electronAPI.writeProjectFile(filePath, serialized);
        return true;
    } catch (error) {
        console.error("프로젝트 저장 실패:", error);
        throw error;
    }
}
