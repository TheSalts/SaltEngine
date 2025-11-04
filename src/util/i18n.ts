/**
 * 다국어 지원 유틸리티
 */

type TranslationKey = string;
type Translations = Record<TranslationKey, string>;

const translations: Record<string, Translations> = {
    "ko-kr": {
        "welcome.title": "SaltEngine",
        "welcome.subtitle": "마인크래프트 2D 게임 엔진 에디터",
        "welcome.openProject": "프로젝트 열기",
        "welcome.newProject": "새 프로젝트 만들기",
        "welcome.projectName": "프로젝트 이름",
        "welcome.projectPath": "프로젝트 경로",
        "welcome.datapackPath": "Datapack 경로",
        "welcome.resourcepackPath": "Resourcepack 경로",
        "welcome.aspectRatio": "모니터 비율",
        "welcome.minecraftVersion": "Minecraft Version",
        "welcome.create": "만들기",
        "welcome.cancel": "취소",
        "editor.save": "저장",
        "editor.saving": "저장 중...",
        "editor.saved": "저장됨",
        "editor.saveFailed": "저장 실패",
        "editor.noProject": "저장할 프로젝트가 없습니다.",
        "editor.addAsset": "Asset 추가",
        "editor.addText": "Text 추가",
        "editor.properties": "속성",
        "editor.noSelection": "오브젝트를 선택하세요",
        "editor.minSceneRequired": "최소 한 개의 Scene이 필요합니다.",
        "editor.sceneName": "Scene 이름",
    },
};

let currentLanguage: string = "ko-kr";

/**
 * 현재 언어를 설정합니다.
 */
export function setLanguage(lang: string): void {
    if (translations[lang]) {
        currentLanguage = lang;
    }
}

/**
 * 현재 언어를 반환합니다.
 */
export function getLanguage(): string {
    return currentLanguage;
}

/**
 * 번역된 텍스트를 반환합니다.
 */
export function t(key: TranslationKey): string {
    const langTranslations = translations[currentLanguage];
    if (!langTranslations) {
        return key;
    }
    return langTranslations[key] ?? key;
}

/**
 * 사용 가능한 언어 목록을 반환합니다.
 */
export function getAvailableLanguages(): string[] {
    return Object.keys(translations);
}

