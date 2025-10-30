import type { GameObject, ItemDisplayObject, TextDisplayObject } from "../../types/gameObject.js";

/**
 * 캔버스 렌더러 클래스
 */
export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private scale: number = 1;
    private offset: { x: number; y: number } = { x: 0, y: 0 };
    private aspectRatio: string = "16:9";

    /**
     * CanvasRenderer 생성자
     */
    constructor(canvas: HTMLCanvasElement, aspectRatio: string = "16:9") {
        this.canvas = canvas;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas 2D context를 가져올 수 없습니다");
        }
        this.ctx = context;
        this.aspectRatio = aspectRatio;
        this.resizeCanvas();
    }

    /**
     * 캔버스 크기를 조정합니다
     */
    public resizeCanvas(): void {
        const wrapper = this.canvas.parentElement;
        if (!wrapper) return;

        const wrapperWidth = wrapper.clientWidth;
        const wrapperHeight = wrapper.clientHeight;

        // 비율에 맞춰 캔버스 크기 계산
        const [widthRatio, heightRatio] = this.aspectRatio
            .split(":")
            .map(Number) as [number, number];

        let canvasWidth = wrapperWidth - 40;
        let canvasHeight = (canvasWidth / widthRatio) * heightRatio;

        if (canvasHeight > wrapperHeight - 40) {
            canvasHeight = wrapperHeight - 40;
            canvasWidth = (canvasHeight / heightRatio) * widthRatio;
        }

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;

        // 중앙 정렬을 위한 오프셋 계산
        this.offset = {
            x: canvasWidth / 2,
            y: canvasHeight / 2,
        };
    }

    /**
     * 씬의 모든 오브젝트를 렌더링합니다
     */
    public render(objects: GameObject[], selectedId?: string): void {
        // 캔버스 지우기
        this.ctx.fillStyle = "#2d2d30";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 그리드 그리기
        this.drawGrid();

        // 원점 표시
        this.drawOrigin();

        // 오브젝트 렌더링
        for (const obj of objects) {
            this.renderObject(obj, obj.id === selectedId);
        }
    }

    /**
     * 그리드를 그립니다
     */
    private drawGrid(): void {
        const gridSize = 50 * this.scale;
        const { width, height } = this.canvas;

        this.ctx.strokeStyle = "#3c3c3c";
        this.ctx.lineWidth = 1;

        // 수직선
        for (let x = this.offset.x % gridSize; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // 수평선
        for (let y = this.offset.y % gridSize; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    /**
     * 원점을 표시합니다
     */
    private drawOrigin(): void {
        const { x, y } = this.offset;
        const size = 10;

        this.ctx.strokeStyle = "#ff0000";
        this.ctx.lineWidth = 2;

        // X축 (빨강)
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + size * 3, y);
        this.ctx.stroke();

        // Y축 (초록)
        this.ctx.strokeStyle = "#00ff00";
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, y - size * 3);
        this.ctx.stroke();
    }

    /**
     * 오브젝트를 렌더링합니다
     */
    private renderObject(obj: GameObject, isSelected: boolean): void {
        

        this.ctx.save();

        // 트랜스폼 적용
        const screenPos = this.worldToScreen(obj.position);
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate(-obj.rotation * (Math.PI / 180));
        this.ctx.scale(obj.scale.x, obj.scale.y);

        // 오브젝트 타입별 렌더링
        if (obj.type === "item_display") {
            this.renderItemDisplay(obj as ItemDisplayObject);
        } else if (obj.type === "text_display") {
            this.renderTextDisplay(obj as TextDisplayObject);
        }

        // 선택된 오브젝트 표시
        if (isSelected) {
            this.ctx.strokeStyle = "#007acc";
            this.ctx.lineWidth = 2 / this.scale;
            this.ctx.strokeRect(-25, -25, 50, 50);
        }

        this.ctx.restore();
    }

    /**
     * Item Display를 렌더링합니다
     */
    private renderItemDisplay(obj: ItemDisplayObject): void {
        // 임시 박스 렌더링
        this.ctx.fillStyle = "#ff6b6b";
        this.ctx.fillRect(-25, -25, 50, 50);

        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "12px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("🎨", 0, 0);
    }

    /**
     * Text Display를 렌더링합니다
     */
    private renderTextDisplay(obj: TextDisplayObject): void {
        // 배경 박스
        this.ctx.fillStyle = "#4dabf7";
        this.ctx.fillRect(-50, -25, 100, 50);

        // 텍스트
        const textObj = obj as TextDisplayObject;
        const alignment = textObj.properties.alignment || "center";
        const textColor = textObj.properties.textColor || "#ffffff";
        const text = textObj.properties.text || "Text";
        
        this.ctx.fillStyle = textColor;
        this.ctx.font = `14px sans-serif`;
        this.ctx.textAlign = alignment as CanvasTextAlign;
        this.ctx.textBaseline = "middle";

        let textX = 0;
        if (alignment === "left") textX = -45;
        else if (alignment === "right") textX = 45;

        this.ctx.fillText(text, textX, 0);
    }

    /**
     * 월드 좌표를 스크린 좌표로 변환합니다
     */
    private worldToScreen(pos: { x: number; y: number }): { x: number; y: number } {
        return {
            x: this.offset.x + pos.x * this.scale,
            y: this.offset.y - pos.y * this.scale, // Y축 반전
        };
    }

    /**
     * 스크린 좌표를 월드 좌표로 변환합니다
     */
    public screenToWorld(screenPos: { x: number; y: number }): { x: number; y: number } {
        return {
            x: (screenPos.x - this.offset.x) / this.scale,
            y: -(screenPos.y - this.offset.y) / this.scale, // Y축 반전
        };
    }

    /**
     * 줌 레벨을 설정합니다
     */
    public setZoom(scale: number): void {
        this.scale = Math.max(0.1, Math.min(5, scale));
    }

    /**
     * 현재 줌 레벨을 가져옵니다
     */
    public getZoom(): number {
        return this.scale;
    }

    /**
     * 캔버스 좌표를 가져옵니다 (마우스 이벤트용)
     */
    public getCanvasCoordinates(
        clientX: number,
        clientY: number
    ): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    }

    /**
     * 오브젝트가 특정 위치에 있는지 확인합니다
     */
    public hitTest(
        obj: GameObject,
        worldPos: { x: number; y: number }
    ): boolean {
        const dx = worldPos.x - obj.position.x;
        const dy = worldPos.y - obj.position.y;

        // 간단한 사각형 충돌 감지
        const halfWidth = 25 * obj.scale.x;
        const halfHeight = 25 * obj.scale.y;

        return (
            Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight
        );
    }
}

