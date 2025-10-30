/**
 * 렌더러 프로세스 진입점
 */
interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

function displayInfo(): void {
  const infoDiv = document.getElementById('info');
  if (infoDiv && window.electronAPI) {
    infoDiv.innerHTML = `
      <div class="info-card">
        <h2>시스템 정보</h2>
        <p><strong>플랫폼:</strong> ${window.electronAPI.platform}</p>
        <p><strong>Node.js:</strong> ${window.electronAPI.versions.node}</p>
        <p><strong>Chrome:</strong> ${window.electronAPI.versions.chrome}</p>
        <p><strong>Electron:</strong> ${window.electronAPI.versions.electron}</p>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  displayInfo();
});

