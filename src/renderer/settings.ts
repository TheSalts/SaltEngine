import { setLanguage, getLanguage } from "../util/i18n.js";

document.addEventListener("DOMContentLoaded", () => {
    const languageSelect = document.getElementById("languageSelect") as HTMLSelectElement;
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");

    languageSelect.value = getLanguage();

    languageSelect.addEventListener("change", () => {
        setLanguage(languageSelect.value);
    });

    closeSettingsBtn?.addEventListener("click", () => {
        if (window.electronAPI) {
            window.electronAPI.closeSettings?.();
        }
    });
});
