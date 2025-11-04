import type { Project, SaltProjectData } from "../types/project.js";

export function serializeProject(project: Project): string {
    const sceneIds = project.scenes.map((scene) => scene.id);

    const data: SaltProjectData = {
        name: project.name,
        version: "1.0.0",
        aspectRatio: project.aspectRatio,
        minecraftVersion: project.minecraftVersion,
        scenes: sceneIds,
        datapackPath: project.datapackPath,
        resourcepackPath: project.resourcepackPath,
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    };

    return JSON.stringify(data, null, 2);
}

export function deserializeProject(data: SaltProjectData, projectPath: string): Project {
    const scenes: unknown[] = [];

    return {
        name: data.name,
        path: projectPath,
        datapackPath: data.datapackPath ?? "",
        resourcepackPath: data.resourcepackPath ?? "",
        aspectRatio: data.aspectRatio,
        minecraftVersion: data.minecraftVersion ?? "1.21.8",
        scenes: scenes as [],
    };
}
