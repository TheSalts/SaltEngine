import type { GameObject } from "./gameObject.js";

/**
 * Scene 인터페이스
 * 하나의 씬은 여러 게임 오브젝트를 포함할 수 있습니다.
 */
export interface Scene {
    id: string;
    name: string;
    gameObjects: GameObject[];
}

/**
 * Scene 생성 시 사용하는 옵션
 */
export interface CreateSceneOptions {
    name: string;
    gameObjects?: GameObject[];
}

/**
 * Scene을 생성하는 헬퍼 함수
 */
export function createScene(id: string, options: CreateSceneOptions): Scene {
    return {
        id,
        name: options.name,
        gameObjects: options.gameObjects ?? [],
    };
}

