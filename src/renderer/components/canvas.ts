import type { GameObject, Vector2 } from "../../types/gameObject.js";
import type { Scene } from "../../types/scene.js";
import { GameObjectType } from "../../types/gameObject.js";
import { getActiveScene } from "../editor.js";

/**
 * 캔버스 렌더러 및 상호작용 관리 클래스
 */
export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private selectedObject: GameObject | null = null;
    private isDragging: boolean = false;
    private dragStart: Vector2 = { x: 0, y: 0 };
    private cameraOffset: Vector2 = { x: 0, y: 0 };
    private scale: number = 1.0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas 2D context를 가져올 수 없습니다.");
        }
        this.ctx = context;

        this.setupEventListeners();
        this.resize();
        this.render();
    }

    /**
     * 캔버스 크기를 조정합니다.
     */
    resize(): void {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.render();
    }

    /**
     * 씬을 렌더링합니다.
     */
    render(): void {
        const scene = getActiveScene();
        if (!scene) {
            this.clear();
            return;
        }

        this.clear();
        this.ctx.save();

        // 카메라 변환 적용
        this.ctx.translate(this.cameraOffset.x, this.cameraOffset.y);
        this.ctx.scale(this.scale, this.scale);

        // 오브젝트 렌더링
        for (const obj of scene.gameObjects) {
            this.renderObject(obj);
        }

        this.ctx.restore();
    }

    /**
     * 개별 오브젝트를 렌더링합니다.
     */
    private renderObject(obj: GameObject): void {
        this.ctx.save();

        // 위치 및 변환 적용
        this.ctx.translate(obj.position.x, obj.position.y);
        this.ctx.rotate((obj.rotation * Math.PI) / 180);
        this.ctx.scale(obj.scale.x, obj.scale.y);

        // 타입별 렌더링
        switch (obj.type) {
            case GameObjectType.ITEM_DISPLAY:
                this.renderItemDisplay(obj);
                break;
            case GameObjectType.TEXT_DISPLAY:
                this.renderTextDisplay(obj);
                break;
        }

        // 선택된 오브젝트 표시
        if (this.selectedObject?.id === obj.id) {
            this.renderSelection();
        }

        this.ctx.restore();
    }

    /**
     * ItemDisplay 오브젝트를 렌더링합니다.
     */
    private renderItemDisplay(obj: GameObject): void {
        this.ctx.fillStyle = "#4a5568";
        this.ctx.strokeStyle = "#718096";
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(-20, -20, 40, 40);
        this.ctx.strokeRect(-20, -20, 40, 40);

        // 아이콘 표시
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("📦", 0, 0);
    }

    /**
     * TextDisplay 오브젝트를 렌더링합니다.
     */
    private renderTextDisplay(obj: GameObject): void {
        const textObj = obj as any;
        const text = textObj.properties?.text ?? "Text";

        this.ctx.fillStyle = "#2d3748";
        this.ctx.strokeStyle = "#4a5568";
        this.ctx.lineWidth = 2;

        this.ctx.font = "14px Arial";
        const metrics = this.ctx.measureText(text);
        const width = Math.max(metrics.width + 20, 100);
        const height = 40;

        this.ctx.fillRect(-width / 2, -height / 2, width, height);
        this.ctx.strokeRect(-width / 2, -height / 2, width, height);

        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(text, 0, 0);
    }

    /**
     * 선택된 오브젝트 표시
     */
    private renderSelection(): void {
        this.ctx.strokeStyle = "#007acc";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(-25, -25, 50, 50);
        this.ctx.setLineDash([]);

        // 핸들 표시 (크기 조절용)
        const handleSize = 8;
        const handles = [
            { x: -25, y: -25 },
            { x: 25, y: -25 },
            { x: 25, y: 25 },
            { x: -25, y: 25 },
        ];

        this.ctx.fillStyle = "#007acc";
        for (const handle of handles) {
            this.ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
        }
    }

    /**
     * 캔버스를 지웁니다.
     */
    private clear(): void {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);
    }

    /**
     * 이벤트 리스너를 설정합니다.
     */
    private setupEventListeners(): void {
        this.canvas.addEventListener("mousedown", (e: MouseEvent) => this.onMouseDown(e));
        this.canvas.addEventListener("mousemove", (e: MouseEvent) => this.onMouseMove(e));
        this.canvas.addEventListener("mouseup", () => this.onMouseUp());
        this.canvas.addEventListener("wheel", (e: WheelEvent) => this.onWheel(e));
        window.addEventListener("resize", () => this.resize());
    }

    /**
     * 마우스 다운 이벤트 처리
     */
    private onMouseDown(e: MouseEvent): void {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.cameraOffset.x) / this.scale;
        const y = (e.clientY - rect.top - this.cameraOffset.y) / this.scale;

        const scene = getActiveScene();
        if (!scene) return;

        // 오브젝트 선택 검사
        let found: GameObject | null = null;
        for (let i = scene.gameObjects.length - 1; i >= 0; i--) {
            const obj = scene.gameObjects[i];
            if (obj && this.isPointInObject(x, y, obj)) {
                found = obj;
                break;
            }
        }

        this.selectedObject = found ?? null;
        this.isDragging = found !== null;
        if (this.isDragging && found) {
            this.dragStart = {
                x: x - found.position.x,
                y: y - found.position.y,
            };
        }

        this.render();
        this.onSelectionChanged(found);
    }

    /**
     * 마우스 이동 이벤트 처리
     */
    private onMouseMove(e: MouseEvent): void {
        e.preventDefault();
        if (!this.isDragging || !this.selectedObject) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.cameraOffset.x) / this.scale;
        const y = (e.clientY - rect.top - this.cameraOffset.y) / this.scale;

        this.selectedObject.position = {
            x: x - this.dragStart.x,
            y: y - this.dragStart.y,
        };

        this.render();
    }

    /**
     * 마우스 업 이벤트 처리
     */
    private onMouseUp(): void {
        this.isDragging = false;
    }

    /**
     * 휠 이벤트 처리 (줌)
     */
    private onWheel(e: WheelEvent): void {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale = Math.max(0.1, Math.min(5.0, this.scale * delta));
        this.render();
    }

    /**
     * 점이 오브젝트 내부에 있는지 확인
     */
    private isPointInObject(x: number, y: number, obj: GameObject): boolean {
        const dx = x - obj.position.x;
        const dy = y - obj.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < 30; // 간단한 원형 충돌 검사
    }

    /**
     * 선택 변경 콜백 (속성 패널에서 사용)
     */
    private onSelectionChanged(obj: GameObject | null): void {
        // 속성 패널 업데이트는 propertyPanel.ts에서 처리
        const event = new CustomEvent("object-selected", { detail: obj });
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
        return this.selectedObject;
    }
}

