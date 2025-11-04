import type { Animation } from "./animation.js";

/**
 * GameObject의 기본 인터페이스
 * 모든 게임 오브젝트는 이 인터페이스를 구현해야 합니다.
 */
export interface GameObject {
    id: string;
    type: GameObjectType;
    position: Vector2;
    rotation: number;
    scale: Vector2;
    layer?: number;
    animationId?: string;
}

/**
 * 게임 오브젝트 타입 열거형
 */
export enum GameObjectType {
    ASSET = "asset",
    TEXT_DISPLAY = "text_display",
}

/**
 * 2D 벡터 타입
 */
export interface Vector2 {
    x: number;
    y: number;
}

/**
 * Asset 오브젝트의 추가 속성
 */
export interface AssetProperties {
    assetId?: string;
    assetPath?: string;
    transformType?: string;
}

/**
 * TextDisplay 오브젝트의 추가 속성
 */
export interface TextDisplayProperties {
    text: string;
    backgroundColor?: string;
    textColor?: string;
    alignment?: "left" | "center" | "right";
}

/**
 * Asset 게임 오브젝트
 */
export class AssetObject implements GameObject {
    id: string;
    type: GameObjectType;
    position: Vector2;
    rotation: number;
    scale: Vector2;
    properties: AssetProperties;

    constructor(
        id: string,
        position: Vector2 = { x: 0, y: 0 },
        rotation: number = 0,
        scale: Vector2 = { x: 1, y: 1 },
        properties: AssetProperties = {}
    ) {
        this.id = id;
        this.type = GameObjectType.ASSET;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.properties = properties;
    }
}

/**
 * TextDisplay 게임 오브젝트
 */
export class TextDisplayObject implements GameObject {
    id: string;
    type: GameObjectType;
    position: Vector2;
    rotation: number;
    scale: Vector2;
    properties: TextDisplayProperties;

    constructor(
        id: string,
        position: Vector2 = { x: 0, y: 0 },
        rotation: number = 0,
        scale: Vector2 = { x: 1, y: 1 },
        properties: TextDisplayProperties = { text: "" }
    ) {
        this.id = id;
        this.type = GameObjectType.TEXT_DISPLAY;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.properties = properties;
    }
}

