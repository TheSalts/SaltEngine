import type { Scene } from "./scene.js";
import { createScene } from "./scene.js";

export type AspectRatio = "16:9" | "16:10" | "21:9";

export enum AspectRatioEnum {
    ratio16v9 = "16:9",
    ratio16v10 = "16:10",
    ratio21v9 = "21:9",
}

export interface Project {
    name: string;
    path: string;
    datapackPath: string;
    resourcepackPath: string;
    aspectRatio: AspectRatio;
    minecraftVersion: string;
    scenes: Scene[];
}

export interface CreateProjectOptions {
    name: string;
    path: string;
    datapackPath: string;
    resourcepackPath: string;
    aspectRatio?: AspectRatio;
    minecraftVersion?: string;
    scenes?: Scene[];
}

export function createProject(options: CreateProjectOptions): Project {
    const defaultScene = createScene("scene_1", {
        name: "Scene 1",
        gameObjects: [],
    });

    return {
        name: options.name,
        path: options.path,
        datapackPath: options.datapackPath,
        resourcepackPath: options.resourcepackPath,
        aspectRatio: options.aspectRatio ?? "16:9",
        minecraftVersion: options.minecraftVersion ?? "1.21.8",
        scenes: options.scenes ?? [defaultScene],
    };
}

export interface SaltProjectData {
    name: string;
    version: string;
    aspectRatio: AspectRatio;
    minecraftVersion: string;
    scenes: string[];
    datapackPath: string;
    resourcepackPath: string;
    metadata: {
        createdAt?: string;
        updatedAt?: string;
    };
}
