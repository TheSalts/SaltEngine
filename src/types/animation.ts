import type { Vector2 } from "./gameObject.js";

export enum AnimationType {
    POSITION = "position",
    SPRITE = "sprite",
}

export interface AnimationFrame {
    frame: number;
    spritePath?: string;
    duration: number;
}

export interface Animation {
    id: string;
    type: AnimationType;
    fps: 20 | 60;
    duration: number;
    keyframes: AnimationKeyframe[];
    frames?: AnimationFrame[];
}

export interface AnimationKeyframe {
    time: number;
    position: Vector2;
}

export interface GameObjectAnimation {
    objectId: string;
    animationId: string;
    isPlaying: boolean;
    currentTime: number;
}
