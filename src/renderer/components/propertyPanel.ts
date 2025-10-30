import type { GameObject } from "../../types/gameObject.js";
import { GameObjectType } from "../../types/gameObject.js";
import type { ItemDisplayProperties, TextDisplayProperties } from "../../types/gameObject.js";

/**
 * 속성 패널 컴포넌트
 */
export class PropertyPanel {
    private container: HTMLElement;
    private contentContainer: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
        const content = container.querySelector(".property-panel-content");
        if (!content) {
            throw new Error("속성 패널 컨텐츠 요소를 찾을 수 없습니다.");
        }
        this.contentContainer = content as HTMLElement;
        this.setupEventListeners();
    }

    /**
     * 오브젝트 속성을 표시합니다.
     */
    showObjectProperties(obj: GameObject): void {
        this.contentContainer.innerHTML = "";

        // 기본 속성
        this.addPropertyGroup("Transform", () => {
            this.addNumberInput("X", obj.position.x, (value) => {
                obj.position.x = value;
                this.notifyPropertyChanged();
            });
            this.addNumberInput("Y", obj.position.y, (value) => {
                obj.position.y = value;
                this.notifyPropertyChanged();
            });
            this.addNumberInput("Rotation", obj.rotation, (value) => {
                obj.rotation = value;
                this.notifyPropertyChanged();
            });
            this.addNumberInput("Scale X", obj.scale.x, (value) => {
                obj.scale.x = value;
                this.notifyPropertyChanged();
            });
            this.addNumberInput("Scale Y", obj.scale.y, (value) => {
                obj.scale.y = value;
                this.notifyPropertyChanged();
            });
        });

        // 타입별 속성
        switch (obj.type) {
            case GameObjectType.ITEM_DISPLAY:
                this.showItemDisplayProperties(obj as any);
                break;
            case GameObjectType.TEXT_DISPLAY:
                this.showTextDisplayProperties(obj as any);
                break;
        }
    }

    /**
     * ItemDisplay 속성을 표시합니다.
     */
    private showItemDisplayProperties(obj: GameObject & { properties: ItemDisplayProperties }): void {
        this.addPropertyGroup("Item Display", () => {
            this.addTextInput("Item ID", obj.properties.itemId ?? "", (value) => {
                obj.properties.itemId = value;
                this.notifyPropertyChanged();
            });
            this.addTextInput("Item Tag", obj.properties.itemTag ?? "", (value) => {
                obj.properties.itemTag = value;
                this.notifyPropertyChanged();
            });
        });
    }

    /**
     * TextDisplay 속성을 표시합니다.
     */
    private showTextDisplayProperties(obj: GameObject & { properties: TextDisplayProperties }): void {
        this.addPropertyGroup("Text Display", () => {
            this.addTextareaInput("Text", obj.properties.text ?? "", (value) => {
                obj.properties.text = value;
                this.notifyPropertyChanged();
            });
            this.addColorInput("Text Color", obj.properties.textColor ?? "#ffffff", (value) => {
                obj.properties.textColor = value;
                this.notifyPropertyChanged();
            });
            this.addColorInput("Background Color", obj.properties.backgroundColor ?? "#2d3748", (value) => {
                obj.properties.backgroundColor = value;
                this.notifyPropertyChanged();
            });
            this.addSelectInput("Alignment", obj.properties.alignment ?? "left", 
                ["left", "center", "right"], (value) => {
                    obj.properties.alignment = value as "left" | "center" | "right";
                    this.notifyPropertyChanged();
                });
        });
    }

    /**
     * 속성 그룹을 추가합니다.
     */
    private addPropertyGroup(title: string, contentFn: () => void): void {
        const group = document.createElement("div");
        group.className = "property-group";

        const header = document.createElement("div");
        header.className = "property-group-header";
        header.textContent = title;
        group.appendChild(header);

        const content = document.createElement("div");
        content.className = "property-group-content";
        this.contentContainer.appendChild(group);
        group.appendChild(content);

        const originalContainer = this.contentContainer;
        this.contentContainer = content;
        contentFn();
        this.contentContainer = originalContainer;
    }

    /**
     * 숫자 입력 필드를 추가합니다.
     */
    private addNumberInput(label: string, value: number, onChange: (value: number) => void): void {
        const group = document.createElement("div");
        group.className = "property-form-group";

        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        group.appendChild(labelEl);

        const input = document.createElement("input");
        input.type = "number";
        input.step = "0.1";
        input.value = value.toString();
        input.addEventListener("input", () => {
            const numValue = parseFloat(input.value) || 0;
            onChange(numValue);
        });

        group.appendChild(input);
        this.contentContainer.appendChild(group);
    }

    /**
     * 텍스트 입력 필드를 추가합니다.
     */
    private addTextInput(label: string, value: string, onChange: (value: string) => void): void {
        const group = document.createElement("div");
        group.className = "property-form-group";

        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        group.appendChild(labelEl);

        const input = document.createElement("input");
        input.type = "text";
        input.value = value;
        input.addEventListener("input", () => {
            onChange(input.value);
        });

        group.appendChild(input);
        this.contentContainer.appendChild(group);
    }

    /**
     * 텍스트 영역 입력 필드를 추가합니다.
     */
    private addTextareaInput(label: string, value: string, onChange: (value: string) => void): void {
        const group = document.createElement("div");
        group.className = "property-form-group";

        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        group.appendChild(labelEl);

        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.addEventListener("input", () => {
            onChange(textarea.value);
        });

        group.appendChild(textarea);
        this.contentContainer.appendChild(group);
    }

    /**
     * 색상 입력 필드를 추가합니다.
     */
    private addColorInput(label: string, value: string, onChange: (value: string) => void): void {
        const group = document.createElement("div");
        group.className = "property-form-group";

        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        group.appendChild(labelEl);

        const input = document.createElement("input");
        input.type = "color";
        input.value = value;
        input.addEventListener("input", () => {
            onChange(input.value);
        });

        group.appendChild(input);
        this.contentContainer.appendChild(group);
    }

    /**
     * 셀렉트 입력 필드를 추가합니다.
     */
    private addSelectInput(
        label: string,
        value: string,
        options: string[],
        onChange: (value: string) => void
    ): void {
        const group = document.createElement("div");
        group.className = "property-form-group";

        const labelEl = document.createElement("label");
        labelEl.textContent = label;
        group.appendChild(labelEl);

        const select = document.createElement("select");
        for (const option of options) {
            const optionEl = document.createElement("option");
            optionEl.value = option;
            optionEl.textContent = option;
            if (option === value) {
                optionEl.selected = true;
            }
            select.appendChild(optionEl);
        }

        select.addEventListener("change", () => {
            onChange(select.value);
        });

        group.appendChild(select);
        this.contentContainer.appendChild(group);
    }

    /**
     * 선택 없음 상태를 표시합니다.
     */
    showNoSelection(): void {
        this.contentContainer.innerHTML = '<p class="no-selection">오브젝트를 선택하세요</p>';
    }

    /**
     * 이벤트 리스너를 설정합니다.
     */
    private setupEventListeners(): void {
        window.addEventListener("object-selected", ((e: Event) => {
            const customEvent = e as CustomEvent<GameObject | null>;
            if (customEvent.detail) {
                this.showObjectProperties(customEvent.detail);
            } else {
                this.showNoSelection();
            }
        }) as EventListener);
    }

    /**
     * 속성 변경을 알립니다.
     */
    private notifyPropertyChanged(): void {
        const event = new CustomEvent("property-changed");
        window.dispatchEvent(event);
    }
}

