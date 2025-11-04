export interface GameObject {
    id: string;
    type: GameObjectType;
    position: Vector2;
    rotation: number;
    scale: Vector2;
    layer?: number;
    animationId?: string;
}

export enum GameObjectType {
    ASSET = "asset",
    TEXT_DISPLAY = "text_display",
    MESH_3D = "mesh_3d",
}

export enum MeshType {
    BOX = "box",
    SPHERE = "sphere",
    CYLINDER = "cylinder",
    CONE = "cone",
    TORUS = "torus",
    PLANE = "plane",
}

export interface Vector2 {
    x: number;
    y: number;
}

export interface AssetProperties {
    assetId?: string;
    assetPath?: string;
    transformType?: string;
}

export interface TextDisplayProperties {
    text: string;
    backgroundColor?: string;
    textColor?: string;
    alignment?: "left" | "center" | "right";
}

export interface Mesh3DProperties {
    meshType: MeshType;
    color?: number;
    wireframe?: boolean;
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    segments?: number;
}

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

export class Mesh3DObject implements GameObject {
    id: string;
    type: GameObjectType;
    position: Vector2;
    rotation: number;
    scale: Vector2;
    properties: Mesh3DProperties;

    constructor(
        id: string,
        position: Vector2 = { x: 0, y: 0 },
        rotation: number = 0,
        scale: Vector2 = { x: 1, y: 1 },
        properties: Mesh3DProperties = { meshType: MeshType.BOX, color: 0x00aaff }
    ) {
        this.id = id;
        this.type = GameObjectType.MESH_3D;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.properties = properties;
    }
}
