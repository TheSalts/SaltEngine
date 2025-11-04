import type { Project } from "../types/project.js";
import { serializeProject } from "./fileSystem.js";

export async function saveProject(project: Project): Promise<boolean> {
    if (!window.electronAPI) {
        throw new Error("electronAPI가 초기화되지 않았습니다.");
    }

    try {
        const scenesFolder = `${project.path}/scenes`;
        await window.electronAPI.createFolder(scenesFolder);

        for (let i = 0; i < project.scenes.length; i++) {
            const scene = project.scenes[i];
            if (scene) {
                const sceneFileName = `scene${i + 1}.json`;
                const sceneFilePath = `${scenesFolder}/${sceneFileName}`;
                const sceneData = JSON.stringify(scene, null, 2);
                await window.electronAPI.writeProjectFile(sceneFilePath, sceneData);
            }
        }

        const filePath = `${project.path}/${project.name}.salt.json`;
        const serialized = serializeProject(project);
        await window.electronAPI.writeProjectFile(filePath, serialized);
        return true;
    } catch (error) {
        console.error("프로젝트 저장 실패:", error);
        throw error;
    }
}

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
