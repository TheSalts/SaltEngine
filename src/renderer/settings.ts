import { setLanguage, getLanguage, getAvailableLanguages } from "../util/i18n.js";

/**
 * 설정 페이지 초기화
 */
document.addEventListener("DOMContentLoaded", () => {
    const languageSelect = document.getElementById("languageSelect") as HTMLSelectElement;
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");

    // 현재 언어 설정
    languageSelect.value = getLanguage();

    // 언어 변경 이벤트
    languageSelect.addEventListener("change", () => {
        setLanguage(languageSelect.value);
        // 저장 (나중에 localStorage 또는 설정 파일에 저장)
    });

    // 닫기 버튼
    closeSettingsBtn?.addEventListener("click", () => {
        if (window.electronAPI) {
            window.electronAPI.closeSettings?.();
        }
    });
});

