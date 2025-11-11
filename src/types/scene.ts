import type { GameObject } from "./gameObject.js";
import type { Group } from "./group.js";

export interface Layer {
    id: number;
    name: string;
    visible: boolean;
    locked: boolean;
}

export interface Scene {
    id: string;
    name: string;
    gameObjects: GameObject[];
    layers?: Layer[];
    groups?: Group[];
}

export interface CreateSceneOptions {
    name: string;
    gameObjects?: GameObject[];
    layers?: Layer[];
}

export function createScene(id: string, options: CreateSceneOptions): Scene {
    const defaultLayers: Layer[] = [{ id: 0, name: "Default", visible: true, locked: false }];
    return {
        id,
        name: options.name,
        gameObjects: options.gameObjects ?? [],
        layers: options.layers ?? defaultLayers,
    };
}
