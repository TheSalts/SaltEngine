import type { Scene } from "./scene.js";

/**
 * 모니터 비율 타입
 */
export type AspectRatio = "16:9" | "16:10" | "21:9";
export enum AspectRatioEnum {
    ratio16v9 = "16:9",
    ratio16v10 = "16:10",
    ratio21v9 = "21:9",
}

/**
 * Project 인터페이스
 * 프로젝트의 모든 정보를 담고 있습니다.
 */
export interface Project {
    name: string;
    path: string;
    datapackPath: string;
    resourcepackPath: string;
    aspectRatio: AspectRatio;
    scenes: Scene[];
}

/**
 * 새 프로젝트 생성 시 사용하는 옵션
 */
export interface CreateProjectOptions {
    name: string;
    path: string;
    datapackPath: string;
    resourcepackPath: string;
    aspectRatio?: AspectRatio;
    scenes?: Scene[];
}

/**
 * Project를 생성하는 헬퍼 함수
 */
export function createProject(options: CreateProjectOptions): Project {
    return {
        name: options.name,
        path: options.path,
        datapackPath: options.datapackPath,
        resourcepackPath: options.resourcepackPath,
        aspectRatio: options.aspectRatio ?? "16:9",
        scenes: options.scenes ?? [],
    };
}

/**
 * .salt.json 파일의 직렬화 구조
 */
export interface SaltProjectData {
    name: string;
    version: string;
    aspectRatio: AspectRatio;
    scenes: Scene[];
    metadata?: {
        datapackPath?: string;
        resourcepackPath?: string;
        createdAt?: string;
        updatedAt?: string;
    };
}
