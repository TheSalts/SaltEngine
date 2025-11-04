import type { GameObject } from "./gameObject.js";

/**
 * Layer 인터페이스
 */
export interface Layer {
    id: number;
    name: string;
    visible: boolean;
    locked: boolean;
}

import type { Group } from "./group.js";

/**
 * Scene 인터페이스
 * 하나의 씬은 여러 게임 오브젝트를 포함할 수 있습니다.
 */
export interface Scene {
    id: string;
    name: string;
    gameObjects: GameObject[];
    layers?: Layer[];
    groups?: Group[];
}

/**
 * Scene 생성 시 사용하는 옵션
 */
export interface CreateSceneOptions {
    name: string;
    gameObjects?: GameObject[];
    layers?: Layer[];
}

/**
 * Scene을 생성하는 헬퍼 함수
 */
export function createScene(id: string, options: CreateSceneOptions): Scene {
    const defaultLayers: Layer[] = [
        { id: 0, name: "Default", visible: true, locked: false },
    ];
    return {
        id,
        name: options.name,
        gameObjects: options.gameObjects ?? [],
        layers: options.layers ?? defaultLayers,
    };
}

