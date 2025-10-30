import { contextBridge, ipcRenderer } from 'electron';

/**
 * 메인 프로세스와 렌더러 프로세스 간 통신 브릿지
 */
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

