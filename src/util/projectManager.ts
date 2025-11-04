import type { Project } from "../types/project.js";
import type { Scene } from "../types/scene.js";
import { serializeProject } from "./fileSystem.js";

/**
 * 프로젝트 파일을 저장합니다.
 */
export async function saveProject(project: Project): Promise<boolean> {
    if (!window.electronAPI) {
        throw new Error("electronAPI가 초기화되지 않았습니다.");
    }

    try {
        // scenes 폴더 생성
        const scenesFolder = `${project.path}/scenes`;
        await window.electronAPI.createFolder(scenesFolder);

        // 각 Scene을 개별 파일로 저장
        for (let i = 0; i < project.scenes.length; i++) {
            const scene = project.scenes[i];
            if (scene) {
                const sceneFileName = `scene${i + 1}.json`;
                const sceneFilePath = `${scenesFolder}/${sceneFileName}`;
                const sceneData = JSON.stringify(scene, null, 2);
                await window.electronAPI.writeProjectFile(sceneFilePath, sceneData);
            }
        }

        // 프로젝트 파일 저장
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
