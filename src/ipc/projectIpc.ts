import { ipcMain, dialog } from "electron";
import { promises as fs } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

export function registerProjectIpcHandlers(): void {
    ipcMain.handle("project:open-dialog", async (_event: unknown) => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [
                { name: "Salt Project", extensions: ["salt.json"] },
                { name: "All Files", extensions: ["*"] },
            ],
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

    ipcMain.handle("project:save-dialog", async (_event: unknown, defaultPath?: string) => {
        const result = await dialog.showSaveDialog({
            defaultPath: defaultPath ?? "project.salt.json",
            filters: [
                { name: "SaltEngine Project", extensions: ["salt.json"] },
                { name: "All Files", extensions: ["*"] },
            ],
        });

        if (result.canceled || !result.filePath) {
            return null;
        }

        return result.filePath;
    });

    ipcMain.handle("project:read-file", async (_event: unknown, filePath: string) => {
        try {
            const content = await fs.readFile(filePath, "utf-8");
            return JSON.parse(content);
        } catch (error) {
            console.error("프로젝트 파일 읽기 실패:", error);
            throw error;
        }
    });

    ipcMain.handle("project:write-file", async (_event: unknown, filePath: string, data: string) => {
        try {
            await fs.writeFile(filePath, data, "utf-8");
            return true;
        } catch (error) {
            console.error("프로젝트 파일 저장 실패:", error);
            throw error;
        }
    });

    ipcMain.handle("dialog:select-folder", async (_event: unknown, title: string) => {
        const result = await dialog.showOpenDialog({
            title: title,
            properties: ["openDirectory"],
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

    ipcMain.handle("fs:create-folder", async (_event: unknown, folderPath: string) => {
        try {
            if (!existsSync(folderPath)) {
                await fs.mkdir(folderPath, { recursive: true });
            }
            return true;
        } catch (error) {
            console.error("폴더 생성 실패:", error);
            throw error;
        }
    });

    ipcMain.handle("fs:folder-exists", async (_event: unknown, folderPath: string) => {
        try {
            return existsSync(folderPath);
        } catch (error) {
            console.error("폴더 확인 실패:", error);
            return false;
        }
    });

    ipcMain.handle("project:find-files", async (_event: unknown, folderPath: string) => {
        try {
            if (!existsSync(folderPath)) {
                return [];
            }

            const files = readdirSync(folderPath);
            const projectFiles: string[] = [];

            for (const file of files) {
                if (file.endsWith(".salt.json")) {
                    projectFiles.push(join(folderPath, file));
                }
            }

            return projectFiles;
        } catch (error) {
            console.error("프로젝트 파일 찾기 실패:", error);
            return [];
        }
    });

    ipcMain.handle("asset:select-image", async (_event: unknown) => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [
                { name: "Images", extensions: ["jpg", "jpeg", "png"] },
                { name: "All Files", extensions: ["*"] },
            ],
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

    ipcMain.handle("fs:copy-file", async (_event: unknown, sourcePath: string, destPath: string) => {
        try {
            await fs.copyFile(sourcePath, destPath);
            return true;
        } catch (error) {
            console.error("파일 복사 실패:", error);
            throw error;
        }
    });

    ipcMain.handle("fs:get-extension", async (_event: unknown, filePath: string) => {
        return extname(filePath);
    });

    ipcMain.handle("fs:read-dir", async (_event: unknown, folderPath: string) => {
        try {
            if (!existsSync(folderPath)) {
                return [];
            }
            const files = readdirSync(folderPath);
            return files.map(file => join(folderPath, file));
        } catch (error) {
            console.error("폴더 읽기 실패:", error);
            return [];
        }
    });

    ipcMain.handle("fs:read-image-base64", async (_event: unknown, filePath: string) => {
        try {
            if (!existsSync(filePath)) {
                return null;
            }
            const imageBuffer = await fs.readFile(filePath);
            const ext = extname(filePath).toLowerCase();
            let mimeType = "image/png";
            if (ext === ".jpg" || ext === ".jpeg") {
                mimeType = "image/jpeg";
            }
            const base64 = imageBuffer.toString("base64");
            return `data:${mimeType};base64,${base64}`;
        } catch (error) {
            console.error("이미지 읽기 실패:", error);
            return null;
        }
    });
}
