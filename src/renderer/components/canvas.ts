import type { GameObject, Vector2, AssetObject, Mesh3DObject } from "../../types/gameObject.js";
import type { Scene } from "../../types/scene.js";
import { GameObjectType, MeshType } from "../../types/gameObject.js";
import { getActiveScene, getCurrentProject } from "../editor.js";
import * as THREE from "three";

export class CanvasRenderer {
    private container: HTMLElement;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private selectedObjects: Set<GameObject> = new Set();
    private isDragging: boolean = false;
    private isPanning: boolean = false;
    private isSelecting: boolean = false;
    private isResizing: boolean = false;
    private resizeHandle: number = -1;
    private dragStart: Vector2 = { x: 0, y: 0 };
    private selectionStart: Vector2 = { x: 0, y: 0 };
    private cameraOffset: Vector2 = { x: 0, y: 0 };
    private cameraDistance: number = 500;
    private scale: number = 1.0;
    private snapLines: { x?: number; y?: number } = {};
    private imageCache: Map<string, THREE.Texture> = new Map();
    private aspectRatio: string = "16:9";
    private workspaceBounds: { width: number; height: number } = { width: 1920, height: 1080 };
    private meshMap: Map<string, THREE.Group> = new Map();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private gridHelper: THREE.Group | null = null;
    private workspaceBorder: THREE.Line | null = null;
    private fov: number = 70;

    constructor(canvas: HTMLCanvasElement) {
        this.container = canvas.parentElement!;

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x1e1e1e, 1);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();

        const aspect = canvas.width / canvas.height;
        this.camera = new THREE.PerspectiveCamera(this.fov, aspect, 0.1, 10000);
        this.camera.position.set(0, 0, this.cameraDistance);
        this.camera.lookAt(0, 0, 0);

        const project = getCurrentProject();
        if (project) {
            this.aspectRatio = project.aspectRatio;
        }

        this.createGrid();

        this.createWorkspaceBorder();

        this.setupLights();

        this.setupEventListeners();
        this.resize();
        this.fitWorkspaceToView(); // 작업 영역이 화면에 맞도록 자동 조정
        this.render();
        this.animate();
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    private createGrid(): void {
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
        }

        this.gridHelper = new THREE.Group();

        const gridSize = 50; // 1m = 50 픽셀
        const gridExtent = 2000; // 그리드 범위 (-2000 ~ 2000)
        const gridColor = 0x333333; // 그리드 색상

        for (let x = -gridExtent; x <= gridExtent; x += gridSize) {
            const points = [new THREE.Vector3(x, -gridExtent, -0.1), new THREE.Vector3(x, gridExtent, -0.1)];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: gridColor,
                opacity: 0.3,
                transparent: true,
            });
            const line = new THREE.Line(geometry, material);
            this.gridHelper.add(line);
        }

        for (let y = -gridExtent; y <= gridExtent; y += gridSize) {
            const points = [new THREE.Vector3(-gridExtent, y, -0.1), new THREE.Vector3(gridExtent, y, -0.1)];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: gridColor,
                opacity: 0.3,
                transparent: true,
            });
            const line = new THREE.Line(geometry, material);
            this.gridHelper.add(line);
        }

        this.scene.add(this.gridHelper);
    }

    private createWorkspaceBorder(): void {
        if (this.workspaceBorder) {
            this.scene.remove(this.workspaceBorder);
        }

        const [widthRatio, heightRatio] = this.aspectRatio.split(":").map(Number) as [number, number];
        const width = this.workspaceBounds.width;
        const height = this.workspaceBounds.height;

        const halfWidth = width / 2;
        const halfHeight = height / 2;

        const points = [
            new THREE.Vector3(-halfWidth, -halfHeight, 0),
            new THREE.Vector3(halfWidth, -halfHeight, 0),
            new THREE.Vector3(halfWidth, halfHeight, 0),
            new THREE.Vector3(-halfWidth, halfHeight, 0),
            new THREE.Vector3(-halfWidth, -halfHeight, 0),
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 2,
        });

        this.workspaceBorder = new THREE.Line(geometry, material);
        this.scene.add(this.workspaceBorder);
    }

    private setupLights(): void {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.3);
        pointLight.position.set(-5, 5, 5);
        this.scene.add(pointLight);
    }

    resize(): void {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        this.renderer.setSize(width, height);

        const aspect = width / height;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();

        this.setupWorkspace();

        this.fitWorkspaceToView();

        this.render();
    }

    private setupWorkspace(): void {
        const [widthRatio, heightRatio] = this.aspectRatio.split(":").map(Number) as [number, number];

        this.workspaceBounds = {
            width: 1920,
            height: 1080,
        };

        this.cameraOffset = {
            x: 0,
            y: 0,
        };
    }

    public fitWorkspaceToView(): void {
        const rect = this.container.getBoundingClientRect();
        const canvasWidth = rect.width;
        const canvasHeight = rect.height;

        if (canvasWidth === 0 || canvasHeight === 0) return;

        const workspaceWidth = this.workspaceBounds.width;
        const workspaceHeight = this.workspaceBounds.height;

        const distance = this.cameraDistance;
        const fovRad = (this.fov * Math.PI) / 180;
        const visibleHeight = 2 * Math.tan(fovRad / 2) * distance;
        const visibleWidth = visibleHeight * this.camera.aspect;

        const scaleX = visibleWidth / (workspaceWidth * 1.1);
        const scaleY = visibleHeight / (workspaceHeight * 1.1);

        this.scale = Math.min(scaleX, scaleY);

        this.scale = Math.max(0.1, Math.min(5.0, this.scale));
    }

    render(): void {
        const scene = getActiveScene();
        if (!scene) {
            this.clearScene();
            return;
        }

        this.clearScene();

        this.camera.position.set(this.cameraOffset.x, this.cameraOffset.y, this.cameraDistance / this.scale);
        this.camera.lookAt(this.cameraOffset.x, this.cameraOffset.y, 0);
        this.camera.updateProjectionMatrix();

        const sortedObjects = [...scene.gameObjects].sort((a, b) => {
            const layerA = a.layer ?? 0;
            const layerB = b.layer ?? 0;
            return layerA - layerB;
        });

        for (const obj of sortedObjects) {
            const objLayer = obj.layer ?? 0;
            const layer = scene.layers?.find((l) => l.id === objLayer);
            if (layer && !layer.visible) {
                continue;
            }
            this.renderObject(obj);
        }

        if (this.isSelecting) {
            this.renderSelectionBox();
        }

        this.renderSnapLines();
    }

    private clearScene(): void {
        const objectsToRemove = this.scene.children.filter(
            (child) => child !== this.gridHelper && child !== this.workspaceBorder && !(child instanceof THREE.Light)
        );
        for (const obj of objectsToRemove) {
            this.scene.remove(obj);
        }
        this.meshMap.clear();
    }

    private renderObject(obj: GameObject): void {
        const group = new THREE.Group();
        group.position.set(obj.position.x, obj.position.y, 0);
        group.rotation.z = (obj.rotation * Math.PI) / 180;
        group.scale.set(obj.scale.x, obj.scale.y, 1);

        switch (obj.type) {
            case GameObjectType.ASSET:
                this.renderAssetSync(obj as AssetObject, group);
                break;
            case GameObjectType.TEXT_DISPLAY:
                this.renderTextDisplay(obj, group);
                break;
            case GameObjectType.MESH_3D:
                this.render3DMesh(obj as Mesh3DObject, group);
                break;
        }

        if (this.selectedObjects.has(obj)) {
            this.renderSelection(obj, group);
        }

        this.scene.add(group);
        this.meshMap.set(obj.id, group);
    }

    private renderAssetSync(obj: AssetObject, group: THREE.Group): void {
        const assetPath = obj.properties?.assetPath;
        const project = getCurrentProject();

        const bounds = this.getObjectBounds(obj, false);

        if (assetPath && project) {
            const fullPath = `${project.path}/${assetPath}`;
            const cachedTexture = this.imageCache.get(fullPath);

            if (cachedTexture) {
                const geometry = new THREE.PlaneGeometry(bounds.width, bounds.height);
                const material = new THREE.MeshBasicMaterial({
                    map: cachedTexture,
                    transparent: true,
                });
                const mesh = new THREE.Mesh(geometry, material);
                group.add(mesh);
                return;
            } else if (cachedTexture === undefined) {
                this.loadImage(fullPath).then(() => {
                    this.render();
                });
            }
        }

        const geometry = new THREE.PlaneGeometry(bounds.width, bounds.height);
        const material = new THREE.MeshBasicMaterial({
            color: 0x4a5568,
            transparent: true,
            opacity: 0.8,
        });
        const mesh = new THREE.Mesh(geometry, material);

        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x718096 }));

        group.add(mesh);
        group.add(line);
    }

    private async loadImage(path: string): Promise<THREE.Texture | null> {
        if (this.imageCache.has(path)) {
            return this.imageCache.get(path) ?? null;
        }

        try {
            const base64 = await window.electronAPI.readImageAsBase64?.(path);
            if (!base64) return null;

            const texture = await new Promise<THREE.Texture>((resolve, reject) => {
                const loader = new THREE.TextureLoader();
                loader.load(
                    base64,
                    (texture) => {
                        texture.colorSpace = THREE.SRGBColorSpace;

                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;

                        texture.needsUpdate = true;
                        this.imageCache.set(path, texture);
                        resolve(texture);
                    },
                    undefined,
                    reject
                );
            });

            return texture;
        } catch (error) {
            console.error("이미지 로드 실패:", error);
            return null;
        }
    }

    private renderTextDisplay(obj: GameObject, group: THREE.Group): void {
        const textObj = obj as any;
        const text = textObj.properties?.text ?? "Text";
        const backgroundColor = textObj.properties?.backgroundColor ?? "#2d3748";
        const textColor = textObj.properties?.textColor ?? "#ffffff";

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        canvas.width = 256;
        canvas.height = 128;

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = textColor;
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        const bounds = this.getObjectBounds(obj, false);
        const geometry = new THREE.PlaneGeometry(bounds.width, bounds.height);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
        });
        const mesh = new THREE.Mesh(geometry, material);

        group.add(mesh);
    }

    private render3DMesh(obj: Mesh3DObject, group: THREE.Group): void {
        const {
            meshType,
            color = 0x00aaff,
            wireframe = false,
            width = 50,
            height = 50,
            depth = 50,
            radius = 25,
            segments = 32,
        } = obj.properties;

        let geometry: THREE.BufferGeometry;

        switch (meshType) {
            case MeshType.BOX:
                geometry = new THREE.BoxGeometry(width, height, depth);
                break;
            case MeshType.SPHERE:
                geometry = new THREE.SphereGeometry(radius, segments, segments);
                break;
            case MeshType.CYLINDER:
                geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
                break;
            case MeshType.CONE:
                geometry = new THREE.ConeGeometry(radius, height, segments);
                break;
            case MeshType.TORUS:
                geometry = new THREE.TorusGeometry(radius, radius / 4, 16, segments);
                break;
            case MeshType.PLANE:
                geometry = new THREE.PlaneGeometry(width, height);
                break;
            default:
                geometry = new THREE.BoxGeometry(width, height, depth);
        }

        const material = new THREE.MeshStandardMaterial({
            color,
            wireframe,
            metalness: 0.3,
            roughness: 0.7,
        });

        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
    }

    private getObjectBounds(obj: GameObject, applyScale: boolean = true): { width: number; height: number } {
        let baseWidth: number;
        let baseHeight: number;

        switch (obj.type) {
            case GameObjectType.ASSET:
                const assetObj = obj as AssetObject;
                baseWidth = (assetObj as any).width ?? 40;
                baseHeight = (assetObj as any).height ?? 40;
                break;
            case GameObjectType.TEXT_DISPLAY:
                baseWidth = 100;
                baseHeight = 50;
                break;
            case GameObjectType.MESH_3D:
                const meshObj = obj as Mesh3DObject;
                baseWidth = meshObj.properties.width ?? meshObj.properties.radius ?? 50;
                baseHeight = meshObj.properties.height ?? meshObj.properties.radius ?? 50;
                break;
            default:
                baseWidth = 40;
                baseHeight = 40;
        }

        if (applyScale) {
            return {
                width: baseWidth * obj.scale.x,
                height: baseHeight * obj.scale.y,
            };
        } else {
            return {
                width: baseWidth,
                height: baseHeight,
            };
        }
    }

    private renderSelection(obj: GameObject, group: THREE.Group): void {
        const bounds = this.getObjectBounds(obj, false);
        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;

        const points = [
            new THREE.Vector3(-halfWidth, -halfHeight, 0.1),
            new THREE.Vector3(halfWidth, -halfHeight, 0.1),
            new THREE.Vector3(halfWidth, halfHeight, 0.1),
            new THREE.Vector3(-halfWidth, halfHeight, 0.1),
            new THREE.Vector3(-halfWidth, -halfHeight, 0.1),
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x007acc, linewidth: 2 });
        const line = new THREE.Line(geometry, material);
        group.add(line);
    }

    private renderSelectionBox(): void {
        const rect = this.container.getBoundingClientRect();
        const startWorld = this.screenToWorld(this.selectionStart.x - rect.left, this.selectionStart.y - rect.top);
        const currentWorld = this.screenToWorld(this.dragStart.x - rect.left, this.dragStart.y - rect.top);

        const width = currentWorld.x - startWorld.x;
        const height = currentWorld.y - startWorld.y;
        const centerX = startWorld.x + width / 2;
        const centerY = startWorld.y + height / 2;

        const geometry = new THREE.PlaneGeometry(Math.abs(width), Math.abs(height));
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x007acc }));
        line.position.set(centerX, centerY, 1);

        this.scene.add(line);
    }

    private renderSnapLines(): void {
        if (!this.snapLines.x && !this.snapLines.y) return;

        const distance = this.cameraDistance / this.scale;
        const fovRad = (this.fov * Math.PI) / 180;
        const frustumHeight = 2 * Math.tan(fovRad / 2) * distance;
        const frustumWidth = frustumHeight * this.camera.aspect;

        if (this.snapLines.x !== undefined) {
            const points = [
                new THREE.Vector3(this.snapLines.x, this.cameraOffset.y - frustumHeight / 2, 0.5),
                new THREE.Vector3(this.snapLines.x, this.cameraOffset.y + frustumHeight / 2, 0.5),
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineDashedMaterial({
                color: 0xff6b6b,
                dashSize: 5,
                gapSize: 5,
            });
            const line = new THREE.Line(geometry, material);
            line.computeLineDistances();
            this.scene.add(line);
        }

        if (this.snapLines.y !== undefined) {
            const points = [
                new THREE.Vector3(this.cameraOffset.x - frustumWidth / 2, this.snapLines.y, 0.5),
                new THREE.Vector3(this.cameraOffset.x + frustumWidth / 2, this.snapLines.y, 0.5),
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineDashedMaterial({
                color: 0xff6b6b,
                dashSize: 5,
                gapSize: 5,
            });
            const line = new THREE.Line(geometry, material);
            line.computeLineDistances();
            this.scene.add(line);
        }
    }

    private screenToWorld(screenX: number, screenY: number): Vector2 {
        const rect = this.container.getBoundingClientRect();
        const x = (screenX / rect.width) * 2 - 1;
        const y = -(screenY / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersectionPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, intersectionPoint);

        return { x: intersectionPoint.x, y: intersectionPoint.y };
    }

    private setupEventListeners(): void {
        this.renderer.domElement.addEventListener("mousedown", (e: MouseEvent) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener("mousemove", (e: MouseEvent) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener("mouseup", () => this.onMouseUp());
        this.renderer.domElement.addEventListener("wheel", (e: WheelEvent) => this.onWheel(e));
        this.renderer.domElement.addEventListener("contextmenu", (e: MouseEvent) => e.preventDefault());
        window.addEventListener("resize", () => this.resize());
        window.addEventListener("keydown", (e: KeyboardEvent) => this.onKeyDown(e));
    }

    private onMouseDown(e: MouseEvent): void {
        e.preventDefault();
        const rect = this.container.getBoundingClientRect();
        const worldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

        const scene = getActiveScene();
        if (!scene) return;

        if (e.button === 2) {
            this.isPanning = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.renderer.domElement.style.cursor = "grabbing";
            return;
        }

        if (e.button === 0) {
            if (this.selectedObjects.size === 1) {
                const obj = Array.from(this.selectedObjects)[0];
                if (obj) {
                    const handleIndex = this.getHandleAt(worldPos.x, worldPos.y, obj);
                    if (handleIndex >= 0) {
                        this.isResizing = true;
                        this.resizeHandle = handleIndex;
                        this.dragStart = { x: worldPos.x, y: worldPos.y };

                        const initialScale = { x: obj.scale.x, y: obj.scale.y };
                        const initialPosition = { x: obj.position.x, y: obj.position.y };
                        (this as any).initialScale = initialScale;
                        (this as any).initialPosition = initialPosition;
                        return;
                    }
                }
            }

            let found: GameObject | null = null;
            for (let i = scene.gameObjects.length - 1; i >= 0; i--) {
                const obj = scene.gameObjects[i];
                if (obj && this.isPointInObject(worldPos.x, worldPos.y, obj)) {
                    found = obj;
                    break;
                }
            }

            if (found) {
                if (!e.shiftKey) {
                    this.selectedObjects.clear();
                }
                this.selectedObjects.add(found);
                this.isDragging = true;
                this.dragStart = {
                    x: worldPos.x - found.position.x,
                    y: worldPos.y - found.position.y,
                };
            } else {
                if (!e.shiftKey) {
                    this.selectedObjects.clear();
                }

                this.isSelecting = true;
                this.selectionStart = { x: e.clientX, y: e.clientY };
                this.dragStart = { x: e.clientX, y: e.clientY };
            }

            this.render();
            this.onSelectionChanged();
        }
    }

    private onMouseMove(e: MouseEvent): void {
        const rect = this.container.getBoundingClientRect();
        const worldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

        if (this.isResizing && this.selectedObjects.size === 1) {
            const obj = Array.from(this.selectedObjects)[0];
            if (obj) {
                const initialPosition = (this as any).initialPosition as Vector2;
                const initialScale = (this as any).initialScale as Vector2;
                const baseBounds = this.getObjectBounds(obj, false); // 스케일 미적용 원본 크기

                const initialProps = {
                    position: initialPosition,
                    scale: initialScale,
                    width: baseBounds.width,
                    height: baseBounds.height,
                    rotation: obj.rotation,
                };

                const initialWidth = initialProps.width * initialProps.scale.x;
                const initialHeight = initialProps.height * initialProps.scale.y;

                const halfW = initialWidth / 2;
                const halfH = initialHeight / 2;

                const handles = [
                    { x: -halfW, y: -halfH }, // 0: BL (Bottom Left)
                    { x: halfW, y: -halfH }, // 1: BR (Bottom Right)
                    { x: halfW, y: halfH }, // 2: TR (Top Right)
                    { x: -halfW, y: halfH }, // 3: TL (Top Left)
                    { x: 0, y: -halfH }, // 4: B (Bottom)
                    { x: halfW, y: 0 }, // 5: R (Right)
                    { x: 0, y: halfH }, // 6: T (Top)
                    { x: -halfW, y: 0 }, // 7: L (Left)
                ];

                const anchorLocal = e.altKey
                    ? { x: 0, y: 0 } // 중심점
                    : handles[{ 0: 2, 1: 3, 2: 0, 3: 1, 4: 6, 5: 7, 6: 4, 7: 5 }[this.resizeHandle]!]!;

                const angle = (initialProps.rotation * Math.PI) / 180;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const negAngle = -angle;
                const cosNeg = Math.cos(negAngle);
                const sinNeg = Math.sin(negAngle);

                const mouseVec = { x: worldPos.x - initialProps.position.x, y: worldPos.y - initialProps.position.y };
                const mouseRotated = {
                    x: mouseVec.x * cosNeg - mouseVec.y * sinNeg,
                    y: mouseVec.x * sinNeg + mouseVec.y * cosNeg,
                };

                let newWidthLocal: number;
                let newHeightLocal: number;

                if (e.altKey) {
                    const currentHandle = handles[this.resizeHandle]!;

                    const deltaFromCenter = {
                        x: mouseRotated.x,
                        y: mouseRotated.y,
                    };

                    const handleType = this.getHandleType(this.resizeHandle);

                    if (handleType === "corner") {
                        newWidthLocal = Math.abs(deltaFromCenter.x) * 2;
                        newHeightLocal = Math.abs(deltaFromCenter.y) * 2;
                    } else if (handleType === "horizontal") {
                        newWidthLocal = Math.abs(deltaFromCenter.x) * 2;
                        newHeightLocal = initialHeight;
                    } else {
                        newWidthLocal = initialWidth;
                        newHeightLocal = Math.abs(deltaFromCenter.y) * 2;
                    }
                } else {
                    newWidthLocal = mouseRotated.x - anchorLocal.x;
                    newHeightLocal = mouseRotated.y - anchorLocal.y;

                    const handleType = this.getHandleType(this.resizeHandle);

                    if (handleType === "horizontal") {
                        newHeightLocal = initialHeight;
                    }
                    if (handleType === "vertical") {
                        newWidthLocal = initialWidth;
                    }
                }

                const handleType = this.getHandleType(this.resizeHandle);
                if (handleType === "corner" && e.shiftKey) {
                    const aspectRatio = initialWidth / initialHeight;
                    const newAspectRatio = Math.abs(newWidthLocal) / Math.abs(newHeightLocal);
                    if (newAspectRatio > aspectRatio) {
                        newHeightLocal = (Math.abs(newWidthLocal) / aspectRatio) * Math.sign(newHeightLocal || 1);
                    } else {
                        newWidthLocal = Math.abs(newHeightLocal) * aspectRatio * Math.sign(newWidthLocal || 1);
                    }
                }

                const minSize = 5; // 최소 픽셀 크기
                const absWidth = Math.max(minSize, Math.abs(newWidthLocal));
                const absHeight = Math.max(minSize, Math.abs(newHeightLocal));

                obj.scale.x = absWidth / initialProps.width;
                obj.scale.y = absHeight / initialProps.height;

                if (e.altKey) {
                    obj.position.x = initialProps.position.x;
                    obj.position.y = initialProps.position.y;
                } else {
                    let newCenterLocalX: number;
                    let newCenterLocalY: number;

                    if (handleType === "horizontal") {
                        const signWidth = newWidthLocal >= 0 ? 1 : -1;
                        newCenterLocalX = anchorLocal.x + (absWidth * signWidth) / 2;
                        newCenterLocalY = 0;
                    } else if (handleType === "vertical") {
                        const signHeight = newHeightLocal >= 0 ? 1 : -1;
                        newCenterLocalX = 0;
                        newCenterLocalY = anchorLocal.y + (absHeight * signHeight) / 2;
                    } else {
                        const signWidth = newWidthLocal >= 0 ? 1 : -1;
                        const signHeight = newHeightLocal >= 0 ? 1 : -1;
                        newCenterLocalX = anchorLocal.x + (absWidth * signWidth) / 2;
                        newCenterLocalY = anchorLocal.y + (absHeight * signHeight) / 2;
                    }

                    const newCenterWorldVec = {
                        x: newCenterLocalX * cos - newCenterLocalY * sin,
                        y: newCenterLocalX * sin + newCenterLocalY * cos,
                    };

                    obj.position.x = initialProps.position.x + newCenterWorldVec.x;
                    obj.position.y = initialProps.position.y + newCenterWorldVec.y;
                }

                this.onSelectionChanged();
                this.render();
                return;
            }
        }

        if (this.isPanning) {
            const deltaX = e.clientX - this.dragStart.x;
            const deltaY = e.clientY - this.dragStart.y;

            const rect = this.container.getBoundingClientRect();

            const distance = this.cameraDistance / this.scale;
            const fovRad = (this.fov * Math.PI) / 180;
            const height = 2 * Math.tan(fovRad / 2) * distance;
            const width = height * this.camera.aspect;

            const worldDeltaX = (deltaX / rect.width) * width;
            const worldDeltaY = -(deltaY / rect.height) * height;

            this.cameraOffset.x -= worldDeltaX;
            this.cameraOffset.y -= worldDeltaY;

            this.dragStart = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }

        if (this.isSelecting) {
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }

        if (this.isDragging && this.selectedObjects.size > 0) {
            const scene = getActiveScene();
            if (!scene) return;

            this.snapLines = {};

            for (const obj of this.selectedObjects) {
                const targetX = worldPos.x - this.dragStart.x;
                const targetY = worldPos.y - this.dragStart.y;

                const snapped = this.snapToGridAndObjects(targetX, targetY, obj);

                obj.position = {
                    x: snapped.x,
                    y: snapped.y,
                };

                if (snapped.snapX !== undefined) {
                    this.snapLines.x = snapped.snapX;
                }
                if (snapped.snapY !== undefined) {
                    this.snapLines.y = snapped.snapY;
                }
            }

            this.onSelectionChanged();
            this.render();
        } else {
            if (this.selectedObjects.size === 1) {
                const obj = Array.from(this.selectedObjects)[0];
                if (obj) {
                    const handleIndex = this.getHandleAt(worldPos.x, worldPos.y, obj);
                    if (handleIndex >= 0) {
                        const handleType = this.getHandleType(handleIndex);
                        if (handleType === "corner") {
                            if (handleIndex === 0 || handleIndex === 2) {
                                this.renderer.domElement.style.cursor = "nesw-resize";
                            } else {
                                this.renderer.domElement.style.cursor = "nwse-resize";
                            }
                        } else if (handleType === "horizontal") {
                            this.renderer.domElement.style.cursor = "ew-resize";
                        } else if (handleType === "vertical") {
                            this.renderer.domElement.style.cursor = "ns-resize";
                        }
                        return;
                    }
                }
            }
            this.renderer.domElement.style.cursor = "default";
        }
    }

    private getHandleAt(x: number, y: number, obj: GameObject): number {
        const bounds = this.getObjectBounds(obj);
        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;
        const handleSize = 12 / this.scale;

        const dx = x - obj.position.x;
        const dy = y - obj.position.y;

        const angle = -(obj.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

        const cornerHandles = [
            { x: -halfWidth, y: -halfHeight, index: 0 }, // 좌하단
            { x: halfWidth, y: -halfHeight, index: 1 }, // 우하단
            { x: halfWidth, y: halfHeight, index: 2 }, // 우상단
            { x: -halfWidth, y: halfHeight, index: 3 }, // 좌상단
        ];

        for (const handle of cornerHandles) {
            const hdx = localX - handle.x;
            const hdy = localY - handle.y;
            if (Math.abs(hdx) < handleSize && Math.abs(hdy) < handleSize) {
                return handle.index;
            }
        }

        const edgeHandles = [
            { x: 0, y: -halfHeight, index: 4, type: "vertical" }, // 하단
            { x: halfWidth, y: 0, index: 5, type: "horizontal" }, // 우측
            { x: 0, y: halfHeight, index: 6, type: "vertical" }, // 상단
            { x: -halfWidth, y: 0, index: 7, type: "horizontal" }, // 좌측
        ];

        for (const handle of edgeHandles) {
            const hdx = localX - handle.x;
            const hdy = localY - handle.y;

            if (handle.type === "horizontal") {
                if (Math.abs(hdx) < handleSize && Math.abs(hdy) < halfHeight) {
                    return handle.index;
                }
            } else if (handle.type === "vertical") {
                if (Math.abs(hdx) < halfWidth && Math.abs(hdy) < handleSize) {
                    return handle.index;
                }
            }
        }

        return -1;
    }

    private getHandleType(handleIndex: number): "corner" | "horizontal" | "vertical" {
        if (handleIndex >= 0 && handleIndex <= 3) {
            return "corner";
        } else if (handleIndex === 5 || handleIndex === 7) {
            return "horizontal";
        } else if (handleIndex === 4 || handleIndex === 6) {
            return "vertical";
        }
        return "corner";
    }

    private snapToGridAndObjects(
        x: number,
        y: number,
        currentObj: GameObject
    ): { x: number; y: number; snapX?: number; snapY?: number } {
        const scene = getActiveScene();
        if (!scene) return { x, y };

        const gridSize = 50;
        const snapThreshold = 10;

        const gridSnapX = Math.round(x / gridSize) * gridSize;
        const gridSnapY = Math.round(y / gridSize) * gridSize;

        let snappedX = x;
        let snappedY = y;
        let snapX: number | undefined;
        let snapY: number | undefined;

        if (Math.abs(x - gridSnapX) < snapThreshold) {
            snappedX = gridSnapX;
            snapX = gridSnapX;
        }
        if (Math.abs(y - gridSnapY) < snapThreshold) {
            snappedY = gridSnapY;
            snapY = gridSnapY;
        }

        for (const obj of scene.gameObjects) {
            if (obj.id === currentObj.id || this.selectedObjects.has(obj)) continue;

            if (Math.abs(snappedX - obj.position.x) < snapThreshold) {
                snappedX = obj.position.x;
                snapX = obj.position.x;
            }
            if (Math.abs(snappedY - obj.position.y) < snapThreshold) {
                snappedY = obj.position.y;
                snapY = obj.position.y;
            }
        }

        const result: { x: number; y: number; snapX?: number; snapY?: number } = { x: snappedX, y: snappedY };
        if (snapX !== undefined) {
            result.snapX = snapX;
        }
        if (snapY !== undefined) {
            result.snapY = snapY;
        }
        return result;
    }

    private onMouseUp(): void {
        if (this.isSelecting) {
            const rect = this.container.getBoundingClientRect();
            const startWorld = this.screenToWorld(this.selectionStart.x - rect.left, this.selectionStart.y - rect.top);
            const endWorld = this.screenToWorld(this.dragStart.x - rect.left, this.dragStart.y - rect.top);

            const minX = Math.min(startWorld.x, endWorld.x);
            const maxX = Math.max(startWorld.x, endWorld.x);
            const minY = Math.min(startWorld.y, endWorld.y);
            const maxY = Math.max(startWorld.y, endWorld.y);

            const scene = getActiveScene();
            if (scene) {
                for (const obj of scene.gameObjects) {
                    if (
                        obj.position.x >= minX &&
                        obj.position.x <= maxX &&
                        obj.position.y >= minY &&
                        obj.position.y <= maxY
                    ) {
                        this.selectedObjects.add(obj);
                    }
                }
            }
        }

        if ((this.isDragging || this.isResizing) && this.selectedObjects.size > 0) {
            const event = new CustomEvent("object-position-changed");
            window.dispatchEvent(event);
        }

        this.isDragging = false;
        this.isPanning = false;
        this.isSelecting = false;
        this.isResizing = false;
        this.resizeHandle = -1;
        this.snapLines = {};
        (this as any).initialScale = undefined;
        (this as any).initialPosition = undefined;
        this.renderer.domElement.style.cursor = "default";
        this.render();
    }

    private onWheel(e: WheelEvent): void {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(5.0, this.scale * delta));

        this.scale = newScale;
        this.render();
    }

    private onKeyDown(e: KeyboardEvent): void {
        if ((e.key === "Delete" || e.key === "Backspace") && this.selectedObjects.size > 0) {
            e.preventDefault();
            this.deleteSelectedObjects();
        }
    }

    deleteSelectedObjects(): void {
        const scene = getActiveScene();
        if (!scene) return;

        for (const obj of this.selectedObjects) {
            const index = scene.gameObjects.indexOf(obj);
            if (index >= 0) {
                scene.gameObjects.splice(index, 1);
            }
        }

        this.selectedObjects.clear();
        this.render();
        this.onSelectionChanged();

        const event = new CustomEvent("object-position-changed");
        window.dispatchEvent(event);
    }

    private isPointInObject(x: number, y: number, obj: GameObject): boolean {
        const bounds = this.getObjectBounds(obj);
        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;

        const dx = x - obj.position.x;
        const dy = y - obj.position.y;

        const angle = -(obj.rotation * Math.PI) / 180;
        const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle);

        return Math.abs(rotatedX) <= halfWidth && Math.abs(rotatedY) <= halfHeight;
    }

    private onSelectionChanged(): void {
        const selectedArray = Array.from(this.selectedObjects);
        const selectedObj: GameObject | null = selectedArray.length === 1 && selectedArray[0] ? selectedArray[0] : null;
        const event = new CustomEvent("object-selected", {
            detail: selectedObj,
        });
        window.dispatchEvent(event);
    }

    forceRender(): void {
        this.render();
    }

    getSelectedObject(): GameObject | null {
        const selectedArray = Array.from(this.selectedObjects);
        return selectedArray.length === 1 && selectedArray[0] ? selectedArray[0] : null;
    }

    getSelectedObjects(): GameObject[] {
        return Array.from(this.selectedObjects);
    }
}
