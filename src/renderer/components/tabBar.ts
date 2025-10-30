import type { Scene } from "../../types/scene.js";
import { createScene } from "../../types/scene.js";

/**
 * 탭 바 컴포넌트
 */
export class TabBar {
    private container: HTMLElement;
    private tabs: Map<string, HTMLElement> = new Map();
    private activeTabId: string | null = null;
    private onTabChange: (sceneId: string) => void;
    private onTabClose: (sceneId: string) => void;
    private onTabAdd: () => void;

    constructor(
        container: HTMLElement,
        callbacks: {
            onTabChange: (sceneId: string) => void;
            onTabClose: (sceneId: string) => void;
            onTabAdd: () => void;
        }
    ) {
        this.container = container;
        this.onTabChange = callbacks.onTabChange;
        this.onTabClose = callbacks.onTabClose;
        this.onTabAdd = callbacks.onTabAdd;
        this.render();
    }

    /**
     * 탭을 추가합니다.
     */
    addTab(scene: Scene): void {
        const tabElement = this.createTabElement(scene);
        this.tabs.set(scene.id, tabElement);

        const addButton = this.container.querySelector(".tab-add");
        if (addButton && addButton.parentNode) {
            addButton.parentNode.insertBefore(tabElement, addButton);
        } else {
            this.container.appendChild(tabElement);
        }

        this.setActiveTab(scene.id);
    }

    /**
     * 탭을 제거합니다.
     */
    removeTab(sceneId: string): void {
        const tabElement = this.tabs.get(sceneId);
        if (tabElement) {
            tabElement.remove();
            this.tabs.delete(sceneId);

            if (this.activeTabId === sceneId) {
                const remainingTabs = Array.from(this.tabs.keys());
                if (remainingTabs.length > 0) {
                    const firstTabId = remainingTabs[0];
                    if (firstTabId) {
                        this.setActiveTab(firstTabId);
                    } else {
                        this.activeTabId = null;
                    }
                } else {
                    this.activeTabId = null;
                }
            }
        }
    }

    /**
     * 활성 탭을 설정합니다.
     */
    setActiveTab(sceneId: string): void {
        if (this.activeTabId === sceneId) {
            return;
        }

        // 이전 활성 탭 비활성화
        if (this.activeTabId) {
            const prevTab = this.tabs.get(this.activeTabId);
            if (prevTab) {
                prevTab.classList.remove("active");
            }
        }

        // 새 활성 탭 설정
        this.activeTabId = sceneId;
        const activeTab = this.tabs.get(sceneId);
        if (activeTab) {
            activeTab.classList.add("active");
        }

        this.onTabChange(sceneId);
    }

    /**
     * 탭의 이름을 업데이트합니다.
     */
    updateTabName(sceneId: string, name: string): void {
        const tabElement = this.tabs.get(sceneId);
        if (tabElement) {
        const label = tabElement.querySelector(".tab-label");
        if (label) {
            label.textContent = name ?? "";
        }
        }
    }

    /**
     * 현재 활성 탭 ID를 반환합니다.
     */
    getActiveTabId(): string | null {
        return this.activeTabId;
    }

    /**
     * 탭 요소를 생성합니다.
     */
    private createTabElement(scene: Scene): HTMLElement {
        const tab = document.createElement("div");
        tab.className = "tab";
        tab.dataset.sceneId = scene.id;

        const label = document.createElement("span");
        label.className = "tab-label";
        label.textContent = scene.name;

        const closeBtn = document.createElement("button");
        closeBtn.className = "tab-close";
        closeBtn.textContent = "×";
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.onTabClose(scene.id);
        });

        tab.appendChild(label);
        tab.appendChild(closeBtn);

        tab.addEventListener("click", () => {
            this.setActiveTab(scene.id);
        });

        return tab;
    }

    /**
     * 탭 바를 렌더링합니다.
     */
    private render(): void {
        this.container.innerHTML = "";

        const addButton = document.createElement("div");
        addButton.className = "tab-add";
        addButton.textContent = "+";
        addButton.title = "새 Scene 추가";
        addButton.addEventListener("click", () => {
            this.onTabAdd();
        });

        this.container.appendChild(addButton);
    }
}

