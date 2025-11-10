// 상품 등록 페이지 JavaScript

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeProductRegister();
});

// 상품 등록 페이지 초기화
function initializeProductRegister() {
    // 이미지 미리보기 기능 설정
    setupImagePreview();
    
    // 폼 제출 이벤트 설정
    setupFormSubmission();
}

// 이미지 미리보기 기능 설정
function setupImagePreview() {
    const imageInput = document.getElementById('productImage');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    if (imageInput && imagePreview && previewImg) {
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.style.display = 'none';
            }
        });
    }
}

// 폼 제출 이벤트 설정
function setupFormSubmission() {
    const form = document.getElementById('productForm');
    if (form) {
        form.addEventListener('submit', handleProductSubmit);
    }
}

// 상품 등록 처리
async function handleProductSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = document.getElementById('productBtn');
    const btnText = document.getElementById('productBtnText');
    const btnLoading = document.getElementById('productBtnLoading');
    const errorDiv = document.getElementById('productError');
    
    // 버튼 상태 변경
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    
    // 에러 메시지 숨기기
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // 성공 메시지 표시
            showNotification('상품이 성공적으로 등록되었습니다!', 'success');
            
            // 폼 초기화
            form.reset();
            const imagePreview = document.getElementById('imagePreview');
            if (imagePreview) {
                imagePreview.style.display = 'none';
            }
            
            // 상품 목록 페이지로 이동
            setTimeout(() => {
                window.location.href = '/products';
            }, 1500);
            
        } else {
            // 에러 메시지 표시
            const errorMessage = result.error || '상품 등록 중 오류가 발생했습니다.';
            showNotification(errorMessage, 'error');
            
            if (errorDiv) {
                errorDiv.textContent = errorMessage;
                errorDiv.style.display = 'block';
            }
        }
        
    } catch (error) {
        console.error('상품 등록 오류:', error);
        const errorMessage = '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
        showNotification(errorMessage, 'error');
        
        if (errorDiv) {
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        }
    } finally {
        // 버튼 상태 복원
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// 뒤로가기 함수
function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = '/products';
    }
}


