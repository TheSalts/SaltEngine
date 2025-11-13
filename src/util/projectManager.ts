import type { Project } from "../types/project.js";
import { serializeProject } from "./fileSystem.js";
import {
    DATAPACK_FORMAT,
    DATAPACK_SUPPORTED_FORMATS,
    RESOURCEPACK_FORMAT,
    RESOURCEPACK_SUPPORTED_FORMATS,
} from "./config.js";

async function createDPStructure(datapackPath: string): Promise<void> {
    if (!window.electronAPI) {
        throw new Error("electronAPI가 초기화되지 않았습니다.");
    }

    const packMcmetaContent = JSON.stringify(
        {
            pack: {
                supported_formats: {
                    min_inclusive: DATAPACK_SUPPORTED_FORMATS[0],
                    max_inclusive: DATAPACK_SUPPORTED_FORMATS[1],
                },
                pack_format: DATAPACK_FORMAT,
                description: {
                    text: "SaltEngine datapack",
                },
            },
        },
        null,
        "\t"
    );

    const loadTagContent = JSON.stringify(
        {
            values: ["saltengine:load"],
        },
        null,
        4
    );

    const tickTagContent = JSON.stringify(
        {
            values: ["saltengine:tick"],
        },
        null,
        4
    );

    await window.electronAPI.createFolder(`${datapackPath}/data/minecraft/tags/function`);
    await window.electronAPI.createFolder(`${datapackPath}/data/saltengine/function`);

    await window.electronAPI.writeProjectFile(`${datapackPath}/pack.mcmeta`, packMcmetaContent);
    await window.electronAPI.writeProjectFile(`${datapackPath}/data/minecraft/tags/function/load.json`, loadTagContent);
    await window.electronAPI.writeProjectFile(`${datapackPath}/data/minecraft/tags/function/tick.json`, tickTagContent);
    await window.electronAPI.writeProjectFile(`${datapackPath}/data/saltengine/function/load.mcfunction`, "");
    await window.electronAPI.writeProjectFile(`${datapackPath}/data/saltengine/function/tick.mcfunction`, "");
}

async function createRPStructure(resourcepackPath: string): Promise<void> {
    if (!window.electronAPI) {
        throw new Error("electronAPI가 초기화되지 않았습니다.");
    }

    const packMcmetaContent = JSON.stringify(
        {
            pack: {
                pack_format: RESOURCEPACK_FORMAT,
                supported_formats: RESOURCEPACK_SUPPORTED_FORMATS,
                description: { text: "SaltEngine resourcepack" },
            },
        },
        null,
        2
    );

    await window.electronAPI.writeProjectFile(`${resourcepackPath}/pack.mcmeta`, packMcmetaContent);
}

export async function initPacks(datapackPath: string, resourcepackPath: string): Promise<void> {
    await createDPStructure(datapackPath);
    await createRPStructure(resourcepackPath);
}

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
