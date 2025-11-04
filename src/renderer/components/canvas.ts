import type { GameObject, Vector2, AssetObject } from "../../types/gameObject.js";
import type { Scene } from "../../types/scene.js";
import { GameObjectType } from "../../types/gameObject.js";
import { getActiveScene, getCurrentProject } from "../editor.js";
import * as THREE from "three";

/**
 * three.js 기반 캔버스 렌더러 및 상호작용 관리 클래스
 */
export class CanvasRenderer {
    private container: HTMLElement;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private selectedObjects: Set<GameObject> = new Set();
    private isDragging: boolean = false;
    private isPanning: boolean = false;
    private isSelecting: boolean = false;
    private isResizing: boolean = false;
    private resizeHandle: number = -1;
    private dragStart: Vector2 = { x: 0, y: 0 };
    private selectionStart: Vector2 = { x: 0, y: 0 };
    private cameraOffset: Vector2 = { x: 0, y: 0 };
    private scale: number = 1.0;
    private snapLines: { x?: number; y?: number } = {};
    private imageCache: Map<string, THREE.Texture> = new Map();
    private aspectRatio: string = "16:9";
    private workspaceBounds: { width: number; height: number } = { width: 1920, height: 1080 };
    private meshMap: Map<string, THREE.Group> = new Map();
    private selectionBoxHelper: THREE.LineSegments | null = null;
    private snapLineHelpers: THREE.Group | null = null;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();
    private gridHelper: THREE.Group | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.container = canvas.parentElement!;

        // three.js 초기화
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x1e1e1e, 1);

        // Scene 생성
        this.scene = new THREE.Scene();

        // Camera 생성 (Orthographic for 2D)
        const aspect = canvas.width / canvas.height;
        const frustumSize = 1000;
        this.camera = new THREE.OrthographicCamera(
            (-frustumSize * aspect) / 2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            -frustumSize / 2,
            0.1,
            1000
        );
        this.camera.position.z = 10;

        const project = getCurrentProject();
        if (project) {
            this.aspectRatio = project.aspectRatio;
        }

        // 그리드 생성
        this.createGrid();

        this.setupEventListeners();
        this.resize();
        this.render();
        this.animate();
    }

    /**
     * 애니메이션 루프
     */
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

        // 수평선 (Y축 방향)
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

        // 수직선 (X축 방향)
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

    /**
     * 캔버스 크기를 조정합니다.
     */
    resize(): void {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        this.renderer.setSize(width, height);

        // 카메라 업데이트
        const aspect = width / height;
        const frustumSize = 1000;
        this.camera.left = (-frustumSize * aspect) / 2;
        this.camera.right = (frustumSize * aspect) / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();

        // 화면 비율에 맞게 작업 공간 크기 설정
        this.setupWorkspace();
        this.render();
    }

    /**
     * 화면 비율에 맞게 작업 공간을 설정합니다.
     */
    private setupWorkspace(): void {
        const [widthRatio, heightRatio] = this.aspectRatio.split(":").map(Number) as [number, number];

        // 작업 영역 크기 계산 (FHD 비율 기준)
        this.workspaceBounds = {
            width: 1920,
            height: 1080,
        };

        // 작업 공간을 중앙에 배치
        this.cameraOffset = {
            x: 0,
            y: 0,
        };
    }

    /**
     * 씬을 렌더링합니다.
     */
    render(): void {
        const scene = getActiveScene();
        if (!scene) {
            this.clearScene();
            return;
        }

        this.clearScene();

        // 카메라 변환 적용
        this.camera.position.x = this.cameraOffset.x;
        this.camera.position.y = this.cameraOffset.y;
        this.camera.zoom = this.scale;
        this.camera.updateProjectionMatrix();

        // 오브젝트 렌더링 (layer 순서대로)
        const sortedObjects = [...scene.gameObjects].sort((a, b) => {
            const layerA = a.layer ?? 0;
            const layerB = b.layer ?? 0;
            return layerA - layerB;
        });

        for (const obj of sortedObjects) {
            // Layer가 visible인지 확인
            const objLayer = obj.layer ?? 0;
            const layer = scene.layers?.find((l) => l.id === objLayer);
            if (layer && !layer.visible) {
                continue;
            }
            this.renderObject(obj);
        }

        // 선택 박스 렌더링
        if (this.isSelecting) {
            this.renderSelectionBox();
        }

        // 스냅 기준선 렌더링
        this.renderSnapLines();
    }

    /**
     * Scene을 지웁니다.
     */
    private clearScene(): void {
        // 그리드를 제외하고 모든 오브젝트 제거
        const objectsToRemove = this.scene.children.filter((child) => child !== this.gridHelper);
        for (const obj of objectsToRemove) {
            this.scene.remove(obj);
        }
        this.meshMap.clear();
    }

    /**
     * 개별 오브젝트를 렌더링합니다.
     */
    private renderObject(obj: GameObject): void {
        const group = new THREE.Group();
        group.position.set(obj.position.x, obj.position.y, 0);
        group.rotation.z = (obj.rotation * Math.PI) / 180;
        group.scale.set(obj.scale.x, obj.scale.y, 1);

        // 타입별 렌더링
        switch (obj.type) {
            case GameObjectType.ASSET:
                this.renderAssetSync(obj as AssetObject, group);
                break;
            case GameObjectType.TEXT_DISPLAY:
                this.renderTextDisplay(obj, group);
                break;
        }

        // 선택된 오브젝트 표시
        if (this.selectedObjects.has(obj)) {
            this.renderSelection(obj, group);
        }

        this.scene.add(group);
        this.meshMap.set(obj.id, group);
    }

    /**
     * Asset 오브젝트를 동기적으로 렌더링합니다.
     */
    private renderAssetSync(obj: AssetObject, group: THREE.Group): void {
        const assetPath = obj.properties?.assetPath;
        const project = getCurrentProject();

        if (assetPath && project) {
            const fullPath = `${project.path}/${assetPath}`;
            const cachedTexture = this.imageCache.get(fullPath);

            if (cachedTexture) {
                const bounds = this.getObjectBounds(obj);
                const geometry = new THREE.PlaneGeometry(bounds.width, bounds.height);
                const material = new THREE.MeshBasicMaterial({
                    map: cachedTexture,
                    transparent: true,
                });
                const mesh = new THREE.Mesh(geometry, material);
                group.add(mesh);
                return;
            } else if (cachedTexture === undefined) {
                // 이미지 로드 시작 (비동기)
                this.loadImage(fullPath).then(() => {
                    this.render();
                });
            }
        }

        // 이미지가 없으면 기본 아이콘 표시
        const bounds = this.getObjectBounds(obj);
        const geometry = new THREE.PlaneGeometry(bounds.width, bounds.height);
        const material = new THREE.MeshBasicMaterial({
            color: 0x4a5568,
            transparent: true,
            opacity: 0.8,
        });
        const mesh = new THREE.Mesh(geometry, material);

        // 테두리 추가
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x718096 }));

        group.add(mesh);
        group.add(line);
    }

    /**
     * 이미지를 로드합니다.
     */
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

    /**
     * TextDisplay 오브젝트를 렌더링합니다.
     */
    private renderTextDisplay(obj: GameObject, group: THREE.Group): void {
        const textObj = obj as any;
        const text = textObj.properties?.text ?? "Text";
        const backgroundColor = textObj.properties?.backgroundColor ?? "#2d3748";
        const textColor = textObj.properties?.textColor ?? "#ffffff";

        // 배경 박스
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        canvas.width = 256;
        canvas.height = 128;

        // 배경 그리기
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 텍스트 그리기
        ctx.fillStyle = textColor;
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        // 텍스처 생성
        const texture = new THREE.CanvasTexture(canvas);
        const geometry = new THREE.PlaneGeometry(100, 50);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
        });
        const mesh = new THREE.Mesh(geometry, material);

        group.add(mesh);
    }

    /**
     * 오브젝트의 실제 크기를 계산합니다.
     */
    private getObjectBounds(obj: GameObject): { width: number; height: number } {
        switch (obj.type) {
            case GameObjectType.ASSET:
                const assetObj = obj as AssetObject;
                const width = (assetObj as any).width ?? 40;
                const height = (assetObj as any).height ?? 40;
                return {
                    width: width * obj.scale.x,
                    height: height * obj.scale.y,
                };
            case GameObjectType.TEXT_DISPLAY:
                return {
                    width: 100 * obj.scale.x,
                    height: 50 * obj.scale.y,
                };
            default:
                return { width: 40 * obj.scale.x, height: 40 * obj.scale.y };
        }
    }

    /**
     * 선택된 오브젝트 표시
     */
    private renderSelection(obj: GameObject, group: THREE.Group): void {
        const bounds = this.getObjectBounds(obj);
        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;

        // 선택 박스
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

        // 핸들 표시
        const handleSize = 8 / this.scale;
        const handleGeometry = new THREE.PlaneGeometry(handleSize, handleSize);
        const handleMaterial = new THREE.MeshBasicMaterial({ color: 0x007acc });

        const cornerHandles = [
            { x: -halfWidth, y: -halfHeight },
            { x: halfWidth, y: -halfHeight },
            { x: halfWidth, y: halfHeight },
            { x: -halfWidth, y: halfHeight },
        ];

        for (const handle of cornerHandles) {
            const handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
            handleMesh.position.set(handle.x, handle.y, 0.1);
            group.add(handleMesh);
        }

        const edgeHandles = [
            { x: 0, y: -halfHeight },
            { x: halfWidth, y: 0 },
            { x: 0, y: halfHeight },
            { x: -halfWidth, y: 0 },
        ];

        for (const handle of edgeHandles) {
            const handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
            handleMesh.position.set(handle.x, handle.y, 0.1);
            group.add(handleMesh);
        }
    }

    /**
     * 선택 박스를 렌더링합니다.
     */
    private renderSelectionBox(): void {
        const rect = this.container.getBoundingClientRect();
        const startWorld = this.screenToWorld(this.selectionStart.x - rect.left, this.selectionStart.y - rect.top);
        const currentWorld = this.screenToWorld(this.dragStart.x - rect.left, this.dragStart.y - rect.top);

        const width = currentWorld.x - startWorld.x;
        const height = currentWorld.y - startWorld.y;
        const centerX = startWorld.x + width / 2;
        const centerY = startWorld.y + height / 2;

        // 선택 박스 생성
        const geometry = new THREE.PlaneGeometry(Math.abs(width), Math.abs(height));
        const material = new THREE.MeshBasicMaterial({
            color: 0x007acc,
            transparent: true,
            opacity: 0.1,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(centerX, centerY, 1);

        // 테두리
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x007acc }));
        line.position.set(centerX, centerY, 1);

        this.scene.add(mesh);
        this.scene.add(line);
    }

    /**
     * 스냅 기준선을 렌더링합니다.
     */
    private renderSnapLines(): void {
        if (!this.snapLines.x && !this.snapLines.y) return;

        const frustumHeight = (this.camera.top - this.camera.bottom) / this.camera.zoom;
        const frustumWidth = (this.camera.right - this.camera.left) / this.camera.zoom;

        if (this.snapLines.x !== undefined) {
            const points = [
                new THREE.Vector3(this.snapLines.x, -frustumHeight / 2, 0.5),
                new THREE.Vector3(this.snapLines.x, frustumHeight / 2, 0.5),
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
                new THREE.Vector3(-frustumWidth / 2, this.snapLines.y, 0.5),
                new THREE.Vector3(frustumWidth / 2, this.snapLines.y, 0.5),
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

    /**
     * 스크린 좌표를 월드 좌표로 변환합니다.
     */
    private screenToWorld(screenX: number, screenY: number): Vector2 {
        const rect = this.container.getBoundingClientRect();
        const x = (screenX / rect.width) * 2 - 1;
        const y = -(screenY / rect.height) * 2 + 1;

        const vector = new THREE.Vector3(x, y, 0);
        vector.unproject(this.camera);

        return { x: vector.x, y: vector.y };
    }

    /**
     * 이벤트 리스너를 설정합니다.
     */
    private setupEventListeners(): void {
        this.renderer.domElement.addEventListener("mousedown", (e: MouseEvent) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener("mousemove", (e: MouseEvent) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener("mouseup", () => this.onMouseUp());
        this.renderer.domElement.addEventListener("wheel", (e: WheelEvent) => this.onWheel(e));
        this.renderer.domElement.addEventListener("contextmenu", (e: MouseEvent) => e.preventDefault());
        window.addEventListener("resize", () => this.resize());
        window.addEventListener("keydown", (e: KeyboardEvent) => this.onKeyDown(e));
    }

    /**
     * 마우스 다운 이벤트 처리
     */
    private onMouseDown(e: MouseEvent): void {
        e.preventDefault();
        const rect = this.container.getBoundingClientRect();
        const worldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

        const scene = getActiveScene();
        if (!scene) return;

        // 우클릭: 카메라 이동
        if (e.button === 2) {
            this.isPanning = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.renderer.domElement.style.cursor = "grabbing";
            return;
        }

        // 좌클릭: 오브젝트 선택 또는 드래그
        if (e.button === 0) {
            // 크기 조절 핸들 확인
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

            // 오브젝트 선택 검사
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
                // 다중 선택 시작
                this.isSelecting = true;
                this.selectionStart = { x: e.clientX, y: e.clientY };
                this.dragStart = { x: e.clientX, y: e.clientY };
            }

            this.render();
            this.onSelectionChanged();
        }
    }

    /**
     * 마우스 이동 이벤트 처리
     */
    private onMouseMove(e: MouseEvent): void {
        const rect = this.container.getBoundingClientRect();
        const worldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

        // 크기 조절 중
        if (this.isResizing && this.selectedObjects.size === 1) {
            const obj = Array.from(this.selectedObjects)[0];
            if (obj) {
                const baseWidth = (obj as any).width ?? 40;
                const baseHeight = (obj as any).height ?? 40;
                const initialScale = (this as any).initialScale ?? { x: obj.scale.x, y: obj.scale.y };
                const initialPosition = (this as any).initialPosition ?? { x: obj.position.x, y: obj.position.y };

                const handleType = this.getHandleType(this.resizeHandle);

                let newScaleX = initialScale.x;
                let newScaleY = initialScale.y;

                if (handleType === "corner") {
                    const bounds = this.getObjectBounds(obj);
                    const halfWidth = (baseWidth * initialScale.x) / 2;
                    const halfHeight = (baseHeight * initialScale.y) / 2;

                    let initialHandleX: number;
                    let initialHandleY: number;
                    switch (this.resizeHandle) {
                        case 0:
                            initialHandleX = initialPosition.x - halfWidth;
                            initialHandleY = initialPosition.y - halfHeight;
                            break;
                        case 1:
                            initialHandleX = initialPosition.x + halfWidth;
                            initialHandleY = initialPosition.y - halfHeight;
                            break;
                        case 2:
                            initialHandleX = initialPosition.x + halfWidth;
                            initialHandleY = initialPosition.y + halfHeight;
                            break;
                        case 3:
                            initialHandleX = initialPosition.x - halfWidth;
                            initialHandleY = initialPosition.y + halfHeight;
                            break;
                        default:
                            initialHandleX = initialPosition.x;
                            initialHandleY = initialPosition.y;
                    }

                    const distanceX = Math.abs(worldPos.x - initialPosition.x);
                    const distanceY = Math.abs(worldPos.y - initialPosition.y);

                    const initialDistanceX = Math.abs(initialHandleX - initialPosition.x);
                    const initialDistanceY = Math.abs(initialHandleY - initialPosition.y);

                    if (!e.shiftKey) {
                        const currentDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
                        const initialDistance = Math.sqrt(
                            initialDistanceX * initialDistanceX + initialDistanceY * initialDistanceY
                        );

                        if (initialDistance > 0) {
                            const scaleRatio = currentDistance / initialDistance;
                            newScaleX = initialScale.x * scaleRatio;
                            newScaleY = initialScale.y * scaleRatio;
                        }
                    } else {
                        const scaleRatioX = initialDistanceX > 0 ? distanceX / initialDistanceX : 1;
                        const scaleRatioY = initialDistanceY > 0 ? distanceY / initialDistanceY : 1;

                        newScaleX = initialScale.x * scaleRatioX;
                        newScaleY = initialScale.y * scaleRatioY;
                    }
                } else if (handleType === "horizontal") {
                    const bounds = this.getObjectBounds(obj);
                    const halfWidth = (baseWidth * initialScale.x) / 2;

                    let initialHandleX: number;
                    switch (this.resizeHandle) {
                        case 5:
                            initialHandleX = initialPosition.x + halfWidth;
                            break;
                        case 7:
                            initialHandleX = initialPosition.x - halfWidth;
                            break;
                        default:
                            initialHandleX = initialPosition.x;
                    }

                    const distanceX = Math.abs(worldPos.x - initialPosition.x);
                    const initialDistanceX = Math.abs(initialHandleX - initialPosition.x);
                    const scaleRatioX = initialDistanceX > 0 ? distanceX / initialDistanceX : 1;

                    newScaleX = initialScale.x * scaleRatioX;
                } else if (handleType === "vertical") {
                    const bounds = this.getObjectBounds(obj);
                    const halfHeight = (baseHeight * initialScale.y) / 2;

                    let initialHandleY: number;
                    switch (this.resizeHandle) {
                        case 4:
                            initialHandleY = initialPosition.y - halfHeight;
                            break;
                        case 6:
                            initialHandleY = initialPosition.y + halfHeight;
                            break;
                        default:
                            initialHandleY = initialPosition.y;
                    }

                    const distanceY = Math.abs(worldPos.y - initialPosition.y);
                    const initialDistanceY = Math.abs(initialHandleY - initialPosition.y);
                    const scaleRatioY = initialDistanceY > 0 ? distanceY / initialDistanceY : 1;

                    newScaleY = initialScale.y * scaleRatioY;
                }

                obj.scale.x = Math.max(0.1, newScaleX);
                obj.scale.y = Math.max(0.1, newScaleY);

                this.onSelectionChanged();
                this.render();
                return;
            }
        }

        // 카메라 이동 중
        if (this.isPanning) {
            const deltaX = e.clientX - this.dragStart.x;
            const deltaY = e.clientY - this.dragStart.y;

            const rect = this.container.getBoundingClientRect();
            const worldDeltaX = ((deltaX / rect.width) * (this.camera.right - this.camera.left)) / this.camera.zoom;
            const worldDeltaY = (-(deltaY / rect.height) * (this.camera.top - this.camera.bottom)) / this.camera.zoom;

            this.cameraOffset.x -= worldDeltaX;
            this.cameraOffset.y -= worldDeltaY;

            this.dragStart = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }

        // 다중 선택 중
        if (this.isSelecting) {
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }

        // 드래그 중
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
            // 커서 변경 (핸들 호버)
            if (this.selectedObjects.size === 1) {
                const obj = Array.from(this.selectedObjects)[0];
                if (obj) {
                    const handleIndex = this.getHandleAt(worldPos.x, worldPos.y, obj);
                    if (handleIndex >= 0) {
                        const handleType = this.getHandleType(handleIndex);
                        if (handleType === "corner") {
                            if (handleIndex === 0 || handleIndex === 2) {
                                this.renderer.domElement.style.cursor = "nwse-resize";
                            } else {
                                this.renderer.domElement.style.cursor = "nesw-resize";
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

    /**
     * 특정 위치의 핸들 인덱스를 반환합니다.
     */
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
            { x: -halfWidth, y: -halfHeight, index: 0 },
            { x: halfWidth, y: -halfHeight, index: 1 },
            { x: halfWidth, y: halfHeight, index: 2 },
            { x: -halfWidth, y: halfHeight, index: 3 },
        ];

        const edgeHandles = [
            { x: 0, y: -halfHeight, index: 4 },
            { x: halfWidth, y: 0, index: 5 },
            { x: 0, y: halfHeight, index: 6 },
            { x: -halfWidth, y: 0, index: 7 },
        ];

        for (const handle of cornerHandles) {
            const hdx = localX - handle.x;
            const hdy = localY - handle.y;
            if (Math.abs(hdx) < handleSize && Math.abs(hdy) < handleSize) {
                return handle.index;
            }
        }

        for (const handle of edgeHandles) {
            const hdx = localX - handle.x;
            const hdy = localY - handle.y;
            if (handle.index === 5 || handle.index === 7) {
                if (Math.abs(hdx) < handleSize && Math.abs(hdy) < handleSize / 2) {
                    return handle.index;
                }
            }
            if (handle.index === 4 || handle.index === 6) {
                if (Math.abs(hdx) < handleSize / 2 && Math.abs(hdy) < handleSize) {
                    return handle.index;
                }
            }
        }

        return -1;
    }

    /**
     * 핸들 타입을 반환합니다.
     */
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

    /**
     * 그리드 및 다른 오브젝트에 스냅합니다.
     */
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

    /**
     * 마우스 업 이벤트 처리
     */
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

    /**
     * 휠 이벤트 처리 (줌)
     */
    private onWheel(e: WheelEvent): void {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(5.0, this.scale * delta));

        this.scale = newScale;
        this.render();
    }

    /**
     * 키보드 이벤트 처리
     */
    private onKeyDown(e: KeyboardEvent): void {
        if ((e.key === "Delete" || e.key === "Backspace") && this.selectedObjects.size > 0) {
            e.preventDefault();
            this.deleteSelectedObjects();
        }
    }

    /**
     * 선택된 오브젝트를 삭제합니다.
     */
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

    /**
     * 점이 오브젝트 내부에 있는지 확인
     */
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

    /**
     * 선택 변경 콜백 (속성 패널에서 사용)
     */
    private onSelectionChanged(): void {
        const selectedArray = Array.from(this.selectedObjects);
        const selectedObj: GameObject | null = selectedArray.length === 1 && selectedArray[0] ? selectedArray[0] : null;
        const event = new CustomEvent("object-selected", {
            detail: selectedObj,
        });
        window.dispatchEvent(event);
    }

    /**
     * 외부에서 렌더링을 강제로 업데이트합니다.
     */
    forceRender(): void {
        this.render();
    }

    /**
     * 선택된 오브젝트를 반환합니다.
     */
    getSelectedObject(): GameObject | null {
        const selectedArray = Array.from(this.selectedObjects);
        return selectedArray.length === 1 && selectedArray[0] ? selectedArray[0] : null;
    }

    /**
     * 선택된 오브젝트들을 반환합니다.
     */
    getSelectedObjects(): GameObject[] {
        return Array.from(this.selectedObjects);
    }
}
