// 공통 JavaScript 기능들 (유틸리티 함수들)

// 에러 메시지 표시
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.className = 'error-message';
    }
}

// 성공 메시지 표시
function showSuccess(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.className = 'success-message';
    }
}

// 뒤로가기
function goBack() {
    window.history.back();
}