// 전역 JavaScript - 모든 페이지에서 사용

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeGlobal();
});

// 전역 초기화
function initializeGlobal() {
    checkSessionStatus();
    setupGlobalEventListeners();
}

// 전역 이벤트 리스너 설정
function setupGlobalEventListeners() {
    // 로그인 폼 이벤트
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 회원가입 폼 이벤트
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // 충전 폼 이벤트
    const chargeForm = document.getElementById('chargeForm');
    if (chargeForm) {
        chargeForm.addEventListener('submit', handleCharge);
    }
    
    // 상품 등록 폼 이벤트
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', handleProductSubmit);
    }
    
    // 이미지 미리보기 이벤트
    const imageInput = document.getElementById('productImage');
    if (imageInput) {
        imageInput.addEventListener('change', handleImagePreview);
    }
    
    // 충전 옵션 버튼 이벤트
    setupChargeOptions();
}

// 모달 관련 함수들
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
    document.getElementById('registerModal').style.display = 'none';
}

function showRegisterModal() {
    document.getElementById('registerModal').style.display = 'block';
    document.getElementById('loginModal').style.display = 'none';
}

// 모달 닫기
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// 로그인 폼에서 회원가입으로 전환
function switchToRegister() {
    closeModal('loginModal');
    showRegisterModal();
}

// 회원가입 폼에서 로그인으로 전환
function switchToLogin() {
    closeModal('registerModal');
    showLoginModal();
}

// 로그인 처리
async function handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccess('loginError', '로그인 성공!');
            setTimeout(() => {
                closeModal('loginModal');
                updateUserInterface(result.user);
            }, 1000);
        } else {
            const error = await response.json();
            showError('loginError', error.error);
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        showError('loginError', '로그인 중 오류가 발생했습니다.');
    }
}

// 회원가입 처리
async function handleRegister(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        email: formData.get('email'),
        password: formData.get('password'),
        nickname: formData.get('nickname')
    };
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showSuccess('registerError', '회원가입이 완료되었습니다!');
            setTimeout(() => {
                closeModal('registerModal');
                showLoginModal();
            }, 1500);
        } else {
            const error = await response.json();
            console.log('회원가입 실패:', error);
            showError('registerError', error.error);
        }
    } catch (error) {
        console.error('회원가입 오류:', error);
        showError('registerError', '회원가입 중 오류가 발생했습니다.');
    }
}

// 사용자 인터페이스 업데이트
function updateUserInterface(user) {
    if (user) {
        window.currentUser = user;
        const authButtons = document.querySelector('.auth-buttons');
        if (authButtons) {
            authButtons.innerHTML = `
                <div class="user-info">
                    <span>안녕하세요, ${user.nickname}님!</span>
                    <button class="btn btn-outline" onclick="showMyPage()">마이페이지</button>
                    <button class="btn btn-outline" onclick="logout()">로그아웃</button>
                </div>
            `;
        }
    } else {
        window.currentUser = null;
        const authButtons = document.querySelector('.auth-buttons');
        if (authButtons) {
            authButtons.innerHTML = `
                <button class="btn btn-outline" onclick="showLoginModal()">로그인</button>
                <button class="btn btn-primary" onclick="showRegisterModal()">회원가입</button>
            `;
        }
    }
}

// 마이페이지 표시
function showMyPage() {
    window.location.href = '/mypage';
}

// 내 상품 목록 로드
async function loadMyProducts() {
    try {
        const response = await fetch('/api/user/products');
        if (response.ok) {
            const result = await response.json();
            displayMyProducts(result.products);
        } else {
            const error = await response.json();
            console.error('내 상품 로드 실패:', error.error);
            document.getElementById('myProductsList').innerHTML = '<p style="text-align: center; color: #666;">상품을 불러올 수 없습니다.</p>';
        }
    } catch (error) {
        console.error('내 상품 로드 오류:', error);
        document.getElementById('myProductsList').innerHTML = '<p style="text-align: center; color: #666;">상품을 불러올 수 없습니다.</p>';
    }
}

// 내 상품 목록 표시
function displayMyProducts(products) {
    const myProductsList = document.getElementById('myProductsList');
    if (!myProductsList) return;
    
    if (!products || products.length === 0) {
        myProductsList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">등록한 상품이 없습니다.</p>';
        return;
    }
    
    myProductsList.innerHTML = products.map(product => `
        <div class="my-product-item">
            <div class="my-product-image">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.title}">` : 
                    '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 2rem;">📦</div>'
                }
            </div>
            <div class="my-product-info">
                <h4 class="my-product-title">${product.title}</h4>
                <p class="my-product-price">${product.price.toLocaleString()}원</p>
                <p class="my-product-status ${product.is_sold ? 'sold' : 'available'}">
                    ${product.is_sold ? '판매완료' : '판매중'}
                </p>
                <p class="my-product-date">${new Date(product.created_at).toLocaleDateString('ko-KR')}</p>
            </div>
        </div>
    `).join('');
}

// 로그아웃
function logout() {
    showLogoutModal();
}

// 로그아웃 확인 모달 표시
function showLogoutModal() {
    // 기존 모달이 있다면 제거
    const existingModal = document.getElementById('logoutModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'logoutModal';
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>로그아웃</h2>
            <p>정말 로그아웃하시겠습니까?</p>
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                <button class="btn btn-outline" onclick="cancelLogout()" style="flex: 1;">취소</button>
                <button class="btn btn-primary" onclick="confirmLogout()" style="flex: 1;">로그아웃</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 로그아웃 취소
function cancelLogout() {
    const modal = document.getElementById('logoutModal');
    if (modal) {
        modal.remove();
    }
}

// 로그아웃 확인
async function confirmLogout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            // localStorage에서도 사용자 정보 제거
            localStorage.removeItem('user');
            
            showNotification('로그아웃 되었습니다.', 'success');
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showNotification('로그아웃 중 오류가 발생했습니다.', 'error');
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
        showNotification('로그아웃 중 오류가 발생했습니다.', 'error');
    }
}

// 세션 상태 확인
async function checkSessionStatus() {
    try {
        const response = await fetch('/api/check-session');
        if (response.ok) {
            const result = await response.json();
            if (result.logged_in) {
                updateUserInterface(result.user);
                // localStorage에도 저장 (백업용)
                localStorage.setItem('user', JSON.stringify(result.user));
            } else {
                updateUserInterface(null);
                localStorage.removeItem('user');
            }
        } else {
            // 세션 확인 실패 시 localStorage 확인
            checkLoginStatus();
        }
    } catch (error) {
        console.error('세션 확인 오류:', error);
        // 세션 확인 실패 시 localStorage 확인
        checkLoginStatus();
    }
}

// 로그인 상태 확인 (localStorage 기반 - 백업용)
function checkLoginStatus() {
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
        const user = JSON.parse(userInfo);
        updateUserInterface(user);
    } else {
        updateUserInterface(null);
    }
}

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

// 알림 표시
function showNotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // 타입별 색상 설정
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#000';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
}

// 충전 옵션 설정
function setupChargeOptions() {
    const chargeOptions = document.querySelectorAll('.charge-option');
    chargeOptions.forEach(option => {
        option.addEventListener('click', function() {
            // 모든 옵션에서 active 클래스 제거
            chargeOptions.forEach(opt => opt.classList.remove('active'));
            // 클릭된 옵션에 active 클래스 추가
            this.classList.add('active');
        });
    });
}

// 충전 금액 설정
function setChargeAmount(amount) {
    document.getElementById('chargeAmount').value = amount;
    
    // 모든 옵션에서 active 클래스 제거
    document.querySelectorAll('.charge-option').forEach(option => {
        option.classList.remove('active');
    });
    
    // 클릭된 버튼에 active 클래스 추가
    event.target.classList.add('active');
}

// 충전 모달 표시
function showChargeModal() {
    // 마이페이지 모달을 부드럽게 닫기
    const myPageModal = document.getElementById('myPageModal');
    myPageModal.classList.remove('show');
    
    setTimeout(() => {
        myPageModal.style.display = 'none';
        
        // 충전 모달을 부드럽게 열기
        const chargeModal = document.getElementById('chargeModal');
        chargeModal.style.display = 'block';
        
        setTimeout(() => {
            chargeModal.classList.add('show');
        }, 10);
    }, 150); // 애니메이션 시간의 절반
}

// 상품 등록 모달 표시
function showProductRegister() {
    // 마이페이지 모달을 부드럽게 닫기
    const myPageModal = document.getElementById('myPageModal');
    myPageModal.classList.remove('show');
    
    setTimeout(() => {
        myPageModal.style.display = 'none';
        
        // 상품 등록 모달을 부드럽게 열기
        const productModal = document.getElementById('productModal');
        productModal.style.display = 'block';
        
        setTimeout(() => {
            productModal.classList.add('show');
        }, 10);
    }, 150); // 애니메이션 시간의 절반
}

// 충전 처리
async function handleCharge(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const amount = parseInt(formData.get('amount'));
    
    if (!amount || amount < 1000) {
        showError('chargeError', '최소 1,000원 이상 충전해주세요.');
        return;
    }
    
    const chargeBtn = document.getElementById('chargeBtn');
    const chargeBtnText = document.getElementById('chargeBtnText');
    const chargeBtnLoading = document.getElementById('chargeBtnLoading');
    
    // 버튼 비활성화 및 로딩 표시
    chargeBtn.disabled = true;
    chargeBtnText.style.display = 'none';
    chargeBtnLoading.style.display = 'inline';
    
    try {
        const response = await fetch('/api/charge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount: amount })
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccess('chargeError', `충전이 완료되었습니다! ${result.charged_amount.toLocaleString()}원이 추가되었습니다.`);
            setTimeout(() => {
                closeModal('chargeModal');
                // 사용자 정보 업데이트 (서버에서 반환된 새로운 잔액 사용)
                if (window.currentUser) {
                    window.currentUser.money = result.new_balance;
                    updateUserInterface(window.currentUser);
                }
            }, 1500);
        } else {
            const error = await response.json();
            showError('chargeError', error.error);
        }
    } catch (error) {
        console.error('충전 오류:', error);
        showError('chargeError', '충전 중 오류가 발생했습니다.');
    } finally {
        // 버튼 상태 복원
        chargeBtn.disabled = false;
        chargeBtnText.style.display = 'inline';
        chargeBtnLoading.style.display = 'none';
    }
}

// 상품 등록 처리
async function handleProductSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const productBtn = document.getElementById('productBtn');
    const productBtnText = document.getElementById('productBtnText');
    const productBtnLoading = document.getElementById('productBtnLoading');
    
    // 버튼 비활성화 및 로딩 표시
    productBtn.disabled = true;
    productBtnText.style.display = 'none';
    productBtnLoading.style.display = 'inline';
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            body: formData,
            credentials: 'include'  // 쿠키 포함하여 세션 정보 전송
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccess('productError', '상품이 성공적으로 등록되었습니다!');
            setTimeout(() => {
                closeModal('productModal');
                // 폼 초기화
                document.getElementById('productForm').reset();
                document.getElementById('imagePreview').style.display = 'none';
                // 상품 목록 새로고침 (메인 페이지인 경우)
                if (typeof loadLatestProducts === 'function') {
                    loadLatestProducts();
                }
            }, 1500);
        } else {
            const error = await response.json();
            showError('productError', error.error);
        }
    } catch (error) {
        console.error('상품 등록 오류:', error);
        showError('productError', '상품 등록 중 오류가 발생했습니다.');
    } finally {
        // 버튼 상태 복원
        productBtn.disabled = false;
        productBtnText.style.display = 'inline';
        productBtnLoading.style.display = 'none';
    }
}

// 이미지 미리보기 처리
function handleImagePreview(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
    }
}

// 메인화면으로 이동
function goToHome() {
    window.location.href = '/';
}
