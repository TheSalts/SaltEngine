import type { Project, SaltProjectData } from "../types/project.js";
import type { Scene } from "../types/scene.js";

/**
 * 프로젝트를 .salt.json 형식으로 직렬화합니다.
 */
export function serializeProject(project: Project): string {
    // Scene ID만 배열로 변환
    const sceneIds = project.scenes.map(scene => scene.id);
    
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

/**
 * .salt.json 데이터를 Project 객체로 역직렬화합니다.
 */
export function deserializeProject(data: SaltProjectData, projectPath: string): Project {
    // Scene ID 배열을 Scene 객체 배열로 변환 (실제 Scene 파일은 scenes 폴더에서 로드)
    // 여기서는 ID만 반환하고, 실제 Scene 로드는 프로젝트 매니저에서 처리
    const scenes: Scene[] = [];
    
    return {
        name: data.name,
        path: projectPath,
        datapackPath: data.datapackPath ?? "",
        resourcepackPath: data.resourcepackPath ?? "",
        aspectRatio: data.aspectRatio,
        minecraftVersion: data.minecraftVersion ?? "1.21.8",
        scenes: scenes, // 실제 Scene은 scenes 폴더에서 로드해야 함
    };
}
