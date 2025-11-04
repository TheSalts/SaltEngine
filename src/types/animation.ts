import type { Vector2 } from "./gameObject.js";

/**
 * 애니메이션 타입
 */
export enum AnimationType {
    POSITION = "position",
    SPRITE = "sprite",
}

/**
 * 애니메이션 프레임 (스프라이트 변경용)
 */
export interface AnimationFrame {
    frame: number;
    spritePath?: string;
    duration: number;
}

/**
 * 애니메이션 설정
 */
export interface Animation {
    id: string;
    type: AnimationType;
    fps: 20 | 60;
    duration: number;
    keyframes: AnimationKeyframe[];
    frames?: AnimationFrame[];
}

/**
 * 애니메이션 키프레임 (좌표 이동용)
 */
export interface AnimationKeyframe {
    time: number;
    position: Vector2;
}

/**
 * 오브젝트 애니메이션 데이터
 */
export interface GameObjectAnimation {
    objectId: string;
    animationId: string;
    isPlaying: boolean;
    currentTime: number;
}

