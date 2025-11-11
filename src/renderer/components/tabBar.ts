import type { Scene } from "../../types/scene.js";

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

    removeAllTabs(): void {
        for (const [sceneId] of this.tabs) {
            const tabElement = this.tabs.get(sceneId);
            if (tabElement) {
                tabElement.remove();
            }
        }
        this.tabs.clear();
        this.activeTabId = null;
        this.render();
    }

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

    setActiveTab(sceneId: string): void {
        if (this.activeTabId === sceneId) {
            return;
        }

        if (this.activeTabId) {
            const prevTab = this.tabs.get(this.activeTabId);
            if (prevTab) {
                prevTab.classList.remove("active");
            }
        }

        this.activeTabId = sceneId;
        const activeTab = this.tabs.get(sceneId);
        if (activeTab) {
            activeTab.classList.add("active");
        }

        this.onTabChange(sceneId);
    }

    updateTabName(sceneId: string, name: string): void {
        const tabElement = this.tabs.get(sceneId);
        if (tabElement) {
            const label = tabElement.querySelector(".tab-label");
            if (label) {
                label.textContent = name ?? "";
            }
        }
    }

    getActiveTabId(): string | null {
        return this.activeTabId;
    }

    private createTabElement(scene: Scene): HTMLElement {
        const tab = document.createElement("div");
        tab.className = "tab";
        tab.dataset.sceneId = scene.id;

        const label = document.createElement("span");
        label.className = "tab-label";
        label.textContent = scene.name;
        label.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            this.editTabName(scene.id);
        });

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

    private editTabName(sceneId: string): void {
        const tabElement = this.tabs.get(sceneId);
        if (!tabElement) return;

        const label = tabElement.querySelector(".tab-label") as HTMLElement;
        if (!label) return;

        const currentName = label.textContent ?? "";
        const input = document.createElement("input");
        input.type = "text";
        input.value = currentName;
        input.className = "tab-name-input";
        input.style.width = `${label.offsetWidth}px`;
        input.style.height = `${label.offsetHeight}px`;
        input.style.padding = "0";
        input.style.margin = "0";
        input.style.border = "1px solid var(--accent)";
        input.style.background = "var(--bg-tertiary)";
        input.style.color = "var(--text-primary)";
        input.style.fontSize = "inherit";
        input.style.fontFamily = "inherit";

        const finishEdit = (save: boolean) => {
            if (save && input.value.trim()) {
                label.textContent = input.value.trim();
                const event = new CustomEvent("scene-name-changed", {
                    detail: { sceneId, name: input.value.trim() },
                });
                window.dispatchEvent(event);
            }
            input.remove();
            label.style.display = "";
        };

        input.addEventListener("blur", () => finishEdit(true));
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                finishEdit(true);
            } else if (e.key === "Escape") {
                e.preventDefault();
                finishEdit(false);
            }
        });

        label.style.display = "none";
        tabElement.insertBefore(input, label);
        input.focus();
        input.select();
    }

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
