import type { Project, SaltProjectData } from "../types/project.js";

/**
 * 프로젝트를 .salt.json 형식으로 직렬화합니다.
 */
export function serializeProject(project: Project): string {
    const data: SaltProjectData = {
        name: project.name,
        version: "1.0.0",
        aspectRatio: project.aspectRatio,
        scenes: project.scenes,
        metadata: {
            datapackPath: project.datapackPath,
            resourcepackPath: project.resourcepackPath,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    };

    return JSON.stringify(data, null, 2);
}

/**
 * .salt.json 데이터를 Project 객체로 역직렬화합니다.
 */
export function deserializeProject(data: SaltProjectData, projectPath: string): Project {
    return {
        name: data.name,
        path: projectPath,
        datapackPath: data.metadata?.datapackPath ?? "",
        resourcepackPath: data.metadata?.resourcepackPath ?? "",
        aspectRatio: data.aspectRatio,
        scenes: data.scenes,
    };
}
