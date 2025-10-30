import { app, BrowserWindow } from "electron";
// import convert2DToLocal from "./util/convert2dToLocal.js";

let window;

app.on("ready", () => {
    window = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
        },
    });
    window.loadFile("src/renderer/main.html");
});
