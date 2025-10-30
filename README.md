# SaltEngine

Electron + TypeScript 프로젝트

## 설치

```bash
npm install
```

## 개발

```bash
npm run dev
```

## 빌드

```bash
npm run build
```

## 실행

```bash
npm start
```

## 프로젝트 구조

```
SaltEngine/
├── src/
│   ├── main/          # Electron 메인 프로세스
│   │   └── main.ts
│   ├── preload/       # Preload 스크립트
│   │   └── preload.ts
│   └── renderer/      # 렌더러 프로세스
│       ├── index.html
│       ├── renderer.ts
│       └── styles.css
├── dist/              # 빌드 출력 디렉토리
├── package.json
└── tsconfig.json
```

