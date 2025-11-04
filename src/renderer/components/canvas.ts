import type { GameObject, Vector2, AssetObject, Mesh3DObject } from "../../types/gameObject.js";
import type { Scene } from "../../types/scene.js";
import { GameObjectType, MeshType } from "../../types/gameObject.js";
import { getActiveScene, getCurrentProject } from "../editor.js";
import * as THREE from "three";

/**
 * three.js 기반 캔버스 렌더러 및 상호작용 관리 클래스
 */
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
    private selectionBoxHelper: THREE.LineSegments | null = null;
    private snapLineHelpers: THREE.Group | null = null;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();
    private gridHelper: THREE.Group | null = null;
    private workspaceBorder: THREE.Line | null = null;
    private fov: number = 70;

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
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // Scene 생성
        this.scene = new THREE.Scene();

        // Camera 생성 (Perspective for 3D)
        const aspect = canvas.width / canvas.height;
        this.camera = new THREE.PerspectiveCamera(this.fov, aspect, 0.1, 10000);
        this.camera.position.set(0, 0, this.cameraDistance);
        this.camera.lookAt(0, 0, 0);

        const project = getCurrentProject();
        if (project) {
            this.aspectRatio = project.aspectRatio;
        }

        // 그리드 생성
        this.createGrid();

        // 작업 영역 테두리 생성
        this.createWorkspaceBorder();

        // 조명 추가 (3D 메쉬를 위한)
        this.setupLights();

        this.setupEventListeners();
        this.resize();
        this.fitWorkspaceToView(); // 작업 영역이 화면에 맞도록 자동 조정
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
     * 작업 영역 테두리를 생성합니다.
     */
    private createWorkspaceBorder(): void {
        if (this.workspaceBorder) {
            this.scene.remove(this.workspaceBorder);
        }

        const [widthRatio, heightRatio] = this.aspectRatio.split(":").map(Number) as [number, number];
        const width = this.workspaceBounds.width;
        const height = this.workspaceBounds.height;

        // 작업 영역 테두리 좌표
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

    /**
     * 3D 메쉬를 위한 조명을 설정합니다.
     */
    private setupLights(): void {
        // Ambient Light (전체 조명)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Directional Light (방향성 조명)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        // Point Light (포인트 조명)
        const pointLight = new THREE.PointLight(0xffffff, 0.3);
        pointLight.position.set(-5, 5, 5);
        this.scene.add(pointLight);
    }

    /**
     * 캔버스 크기를 조정합니다.
     */
    resize(): void {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        this.renderer.setSize(width, height);

        // 카메라 업데이트 (Perspective Camera)
        const aspect = width / height;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();

        // 화면 비율에 맞게 작업 공간 크기 설정
        this.setupWorkspace();

        // 작업 영역이 화면에 맞도록 자동 조정
        this.fitWorkspaceToView();

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
     * 작업 영역이 화면에 전부 보이도록 확대/축소 배율을 자동으로 조정합니다.
     */
    public fitWorkspaceToView(): void {
        const rect = this.container.getBoundingClientRect();
        const canvasWidth = rect.width;
        const canvasHeight = rect.height;

        if (canvasWidth === 0 || canvasHeight === 0) return;

        // 작업 영역 크기
        const workspaceWidth = this.workspaceBounds.width;
        const workspaceHeight = this.workspaceBounds.height;

        // Perspective 카메라에서 특정 거리에서 보이는 화면 크기 계산
        const distance = this.cameraDistance;
        const fovRad = (this.fov * Math.PI) / 180;
        const visibleHeight = 2 * Math.tan(fovRad / 2) * distance;
        const visibleWidth = visibleHeight * this.camera.aspect;

        // 작업 영역이 화면에 맞도록 스케일 계산 (여백 10% 추가)
        const scaleX = visibleWidth / (workspaceWidth * 1.1);
        const scaleY = visibleHeight / (workspaceHeight * 1.1);

        // 둘 중 작은 스케일 사용 (작업 영역이 완전히 보이도록)
        this.scale = Math.min(scaleX, scaleY);

        // 스케일 범위 제한
        this.scale = Math.max(0.1, Math.min(5.0, this.scale));
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
        this.camera.position.set(this.cameraOffset.x, this.cameraOffset.y, this.cameraDistance / this.scale);
        this.camera.lookAt(this.cameraOffset.x, this.cameraOffset.y, 0);
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
        // 그리드, 작업 영역 테두리, 조명을 제외하고 모든 오브젝트 제거
        const objectsToRemove = this.scene.children.filter(
            (child) => child !== this.gridHelper && child !== this.workspaceBorder && !(child instanceof THREE.Light)
        );
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
            case GameObjectType.MESH_3D:
                this.render3DMesh(obj as Mesh3DObject, group);
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

        // group에 이미 scale이 적용되어 있으므로 원본 크기를 사용
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
                // 이미지 로드 시작 (비동기)
                this.loadImage(fullPath).then(() => {
                    this.render();
                });
            }
        }

        // 이미지가 없으면 기본 아이콘 표시
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
                        // 색상 공간을 sRGB로 설정하여 올바른 색상 표시
                        texture.colorSpace = THREE.SRGBColorSpace;
                        // 텍스처 필터링 설정 (선명도 향상)
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        // 텍스처 업데이트
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
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        // group에 이미 scale이 적용되어 있으므로 원본 크기를 사용
        const bounds = this.getObjectBounds(obj, false);
        const geometry = new THREE.PlaneGeometry(bounds.width, bounds.height);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
        });
        const mesh = new THREE.Mesh(geometry, material);

        group.add(mesh);
    }

    /**
     * 3D 메쉬 오브젝트를 렌더링합니다.
     */
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

        // group에 이미 scale이 적용되어 있지만, 3D mesh는 properties의 원본 크기를 그대로 사용
        // (getObjectBounds와 동일한 값)
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

    /**
     * 오브젝트의 실제 크기를 계산합니다.
     * @param applyScale - 스케일을 적용할지 여부 (기본값: true)
     */
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

    /**
     * 선택된 오브젝트의 바운딩 박스와 크기 조절 핸들을 렌더링합니다.
     * @param obj - 렌더링할 게임 오브젝트
     * @param group - 오브젝트의 THREE.Group (이미 스케일이 적용됨)
     */
    private renderSelection(obj: GameObject, group: THREE.Group): void {
        // group에 이미 scale이 적용되어 있으므로 원본 크기를 사용
        const bounds = this.getObjectBounds(obj, false);
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

        // 핸들은 보이지 않지만 감지를 위해 존재 (투명)
        // 핸들 렌더링을 제거하여 시각적으로 표시하지 않음
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

        // 테두리만 렌더링 (배경은 투명)
        const geometry = new THREE.PlaneGeometry(Math.abs(width), Math.abs(height));
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x007acc }));
        line.position.set(centerX, centerY, 1);

        this.scene.add(line);
    }

    /**
     * 스냅 기준선을 렌더링합니다.
     */
    private renderSnapLines(): void {
        if (!this.snapLines.x && !this.snapLines.y) return;

        // Perspective 카메라의 가시 영역 계산
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

    /**
     * 스크린 좌표를 월드 좌표로 변환합니다. (Z=0 평면에 투영)
     */
    private screenToWorld(screenX: number, screenY: number): Vector2 {
        const rect = this.container.getBoundingClientRect();
        const x = (screenX / rect.width) * 2 - 1;
        const y = -(screenY / rect.height) * 2 + 1;

        // Raycaster를 사용하여 Z=0 평면과의 교차점 계산
        this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

        // Z=0 평면
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersectionPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(plane, intersectionPoint);

        return { x: intersectionPoint.x, y: intersectionPoint.y };
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
     * 오브젝트 선택, 크기 조절, 드래그, 카메라 이동을 처리합니다.
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

        // 좌클릭: 오브젝트 선택, 크기 조절, 드래그
        if (e.button === 0) {
            // 크기 조절 핸들 확인 (선택된 오브젝트가 하나일 때만)
            if (this.selectedObjects.size === 1) {
                const obj = Array.from(this.selectedObjects)[0];
                if (obj) {
                    const handleIndex = this.getHandleAt(worldPos.x, worldPos.y, obj);
                    if (handleIndex >= 0) {
                        // 크기 조절 모드 시작
                        this.isResizing = true;
                        this.resizeHandle = handleIndex;
                        this.dragStart = { x: worldPos.x, y: worldPos.y };

                        // 초기 상태 저장 (크기 조절 중 참조용)
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
     * 크기 조절, 드래그, 다중 선택 등을 처리합니다.
     */
    private onMouseMove(e: MouseEvent): void {
        const rect = this.container.getBoundingClientRect();
        const worldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

        // 크기 조절 중
        if (this.isResizing && this.selectedObjects.size === 1) {
            const obj = Array.from(this.selectedObjects)[0];
            if (obj) {
                // 1. 초기 상태 가져오기
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

                // 2. 로컬 좌표계 및 앵커 포인트 설정
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

                // Alt 키를 누르면 중심 기준으로 확대, 아니면 반대편 핸들이 고정점(Pivot)이 됨
                const anchorLocal = e.altKey
                    ? { x: 0, y: 0 } // 중심점
                    : handles[{ 0: 2, 1: 3, 2: 0, 3: 1, 4: 6, 5: 7, 6: 4, 7: 5 }[this.resizeHandle]!]!;

                // 3. 마우스 위치를 오브젝트의 로컬 좌표계로 변환
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

                // 4. 로컬 좌표계에서 새로운 너비와 높이 계산
                let newWidthLocal: number;
                let newHeightLocal: number;

                if (e.altKey) {
                    // Alt 키: 중심 기준 확대 (양방향으로 동시에 확대)
                    const currentHandle = handles[this.resizeHandle]!;

                    // 마우스가 중심으로부터 얼마나 떨어졌는지 계산
                    const deltaFromCenter = {
                        x: mouseRotated.x,
                        y: mouseRotated.y,
                    };

                    const handleType = this.getHandleType(this.resizeHandle);

                    if (handleType === "corner") {
                        // 모서리: 양쪽 방향으로 확대
                        newWidthLocal = Math.abs(deltaFromCenter.x) * 2;
                        newHeightLocal = Math.abs(deltaFromCenter.y) * 2;
                    } else if (handleType === "horizontal") {
                        // 좌우 핸들: 너비만 변경
                        newWidthLocal = Math.abs(deltaFromCenter.x) * 2;
                        newHeightLocal = initialHeight;
                    } else {
                        // 상하 핸들: 높이만 변경
                        newWidthLocal = initialWidth;
                        newHeightLocal = Math.abs(deltaFromCenter.y) * 2;
                    }
                } else {
                    // 일반 모드: 고정점 기준 크기 조절
                    newWidthLocal = mouseRotated.x - anchorLocal.x;
                    newHeightLocal = mouseRotated.y - anchorLocal.y;

                    const handleType = this.getHandleType(this.resizeHandle);

                    if (handleType === "horizontal") {
                        // 좌우 핸들: 높이는 변하지 않음
                        newHeightLocal = initialHeight;
                    }
                    if (handleType === "vertical") {
                        // 상하 핸들: 너비는 변하지 않음
                        newWidthLocal = initialWidth;
                    }
                }

                // 5. Shift 키 누를 시 비율 유지
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

                // 6. 최소 크기 제한 및 음수 크기 방지
                const minSize = 5; // 최소 픽셀 크기
                const absWidth = Math.max(minSize, Math.abs(newWidthLocal));
                const absHeight = Math.max(minSize, Math.abs(newHeightLocal));

                // 7. 새로운 스케일 계산
                obj.scale.x = absWidth / initialProps.width;
                obj.scale.y = absHeight / initialProps.height;

                // 8. 새로운 중심점 위치 계산
                // Alt 키 모드: 중심점이 고정되므로 위치 변경 없음
                // 일반 모드: 앵커 포인트를 기준으로 새로운 중심점 계산
                if (e.altKey) {
                    // 중심 기준 확대: 위치 변경 없음
                    obj.position.x = initialProps.position.x;
                    obj.position.y = initialProps.position.y;
                } else {
                    // 일반 모드: 고정점 기준 크기 조절
                    let newCenterLocalX: number;
                    let newCenterLocalY: number;

                    if (handleType === "horizontal") {
                        // 좌우 핸들: 너비만 변하고 y좌표는 중심(0) 유지
                        const signWidth = newWidthLocal >= 0 ? 1 : -1;
                        newCenterLocalX = anchorLocal.x + (absWidth * signWidth) / 2;
                        newCenterLocalY = 0;
                    } else if (handleType === "vertical") {
                        // 상하 핸들: 높이만 변하고 x좌표는 중심(0) 유지
                        const signHeight = newHeightLocal >= 0 ? 1 : -1;
                        newCenterLocalX = 0;
                        newCenterLocalY = anchorLocal.y + (absHeight * signHeight) / 2;
                    } else {
                        // 모서리 핸들: 너비와 높이 모두 변함
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

        // 카메라 이동 중
        if (this.isPanning) {
            const deltaX = e.clientX - this.dragStart.x;
            const deltaY = e.clientY - this.dragStart.y;

            const rect = this.container.getBoundingClientRect();
            // Perspective 카메라에서 화면 이동 거리를 월드 좌표로 변환
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
                            // 0: 좌하단, 2: 우상단 → nesw-resize (↗↙)
                            // 1: 우하단, 3: 좌상단 → nwse-resize (↖↘)
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

    /**
     * 특정 월드 좌표에서 오브젝트의 크기 조절 핸들을 감지합니다.
     * @param x - 월드 좌표 X
     * @param y - 월드 좌표 Y
     * @param obj - 대상 게임 오브젝트
     * @returns 핸들 인덱스 (0-7) 또는 -1 (핸들 없음)
     *          0: 좌하단, 1: 우하단, 2: 우상단, 3: 좌상단
     *          4: 하단, 5: 우측, 6: 상단, 7: 좌측
     */
    private getHandleAt(x: number, y: number, obj: GameObject): number {
        const bounds = this.getObjectBounds(obj);
        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;
        const handleSize = 12 / this.scale;

        // 월드 좌표를 오브젝트의 로컬 좌표계로 변환
        const dx = x - obj.position.x;
        const dy = y - obj.position.y;

        const angle = -(obj.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

        // 모서리 핸들 (정사각형 영역)
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

        // 엣지 핸들 (직사각형 영역)
        const edgeHandles = [
            { x: 0, y: -halfHeight, index: 4, type: "vertical" }, // 하단
            { x: halfWidth, y: 0, index: 5, type: "horizontal" }, // 우측
            { x: 0, y: halfHeight, index: 6, type: "vertical" }, // 상단
            { x: -halfWidth, y: 0, index: 7, type: "horizontal" }, // 좌측
        ];

        for (const handle of edgeHandles) {
            const hdx = localX - handle.x;
            const hdy = localY - handle.y;

            // 수평 핸들은 세로로 좁고 가로로 넓음
            if (handle.type === "horizontal") {
                if (Math.abs(hdx) < handleSize && Math.abs(hdy) < halfHeight) {
                    return handle.index;
                }
            }
            // 수직 핸들은 가로로 좁고 세로로 넓음
            else if (handle.type === "vertical") {
                if (Math.abs(hdx) < halfWidth && Math.abs(hdy) < handleSize) {
                    return handle.index;
                }
            }
        }

        return -1;
    }

    /**
     * 핸들 인덱스에 따라 핸들 타입을 반환합니다.
     * @param handleIndex - 핸들 인덱스 (0-7)
     * @returns 핸들 타입
     *          - "corner": 모서리 핸들 (0-3), 너비와 높이 모두 조절
     *          - "horizontal": 좌우 핸들 (5, 7), 너비만 조절
     *          - "vertical": 상하 핸들 (4, 6), 높이만 조절
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
