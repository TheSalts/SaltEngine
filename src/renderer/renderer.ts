// HTML DOM 조작을 위한 렌더러 프로세스 스크립트

document.addEventListener("DOMContentLoaded", () => {
    const h1 = document.querySelector("h1");
    if (h1) {
        h1.textContent = "Hello from TypeScript!";
        h1.style.color = "blue";
    }

    // 버튼 예제 추가
    const button = document.createElement("button");
    button.textContent = "클릭하세요";
    button.addEventListener("click", () => {
        alert("버튼이 클릭되었습니다!");
    });
    document.body.appendChild(button);
});
