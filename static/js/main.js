// 메인 JavaScript 파일

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 앱 초기화
function initializeApp() {
    setupEventListeners();
    loadLatestProducts();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 로그인 폼 제출
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // 회원가입 폼 제출
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // 모달 외부 클릭 시 닫기 기능 제거 (사용자 편의를 위해)
    // window.addEventListener('click', function(event) {
    //     if (event.target.classList.contains('modal')) {
    //         event.target.style.display = 'none';
    //     }
    // });
}

// 로그인 모달 표시
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
    document.getElementById('registerModal').style.display = 'none';
}

// 회원가입 모달 표시
function showRegisterModal() {
    document.getElementById('registerModal').style.display = 'block';
    document.getElementById('loginModal').style.display = 'none';
}

// 모달 닫기
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
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
    
    // 에러 메시지 숨기기
    hideError('loginError');
    
    const formData = new FormData(event.target);
    const loginData = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    // 로딩 상태 표시
    setLoadingState('loginBtn', true);
    
    try {
        // 실제로는 Flask API로 요청을 보내야 함
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccess('loginError', '로그인 성공!');
            setTimeout(() => {
                closeModal('loginModal');
                // 로그인 성공 후 처리 (예: 사용자 정보 표시, 페이지 리다이렉트 등)
                updateUserInterface(result.user);
            }, 1000);
        } else {
            const error = await response.json();
            showError('loginError', error.error || '로그인에 실패했습니다.');
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        showError('loginError', '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
        // 로딩 상태 해제
        setLoadingState('loginBtn', false);
    }
}

// 회원가입 처리
async function handleRegister(event) {
    event.preventDefault();
    
    // 에러 메시지 숨기기
    hideError('registerError');
    
    const formData = new FormData(event.target);
    const registerData = {
        email: formData.get('email'),
        nickname: formData.get('nickname'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword')
    };
    
    // 디버깅을 위한 콘솔 로그
    console.log('회원가입 데이터:', registerData);
    
    // 비밀번호 확인
    if (registerData.password !== registerData.confirmPassword) {
        showError('registerError', '비밀번호가 일치하지 않습니다.');
        return;
    }
    
    // 비밀번호 길이 확인
    if (registerData.password.length < 6) {
        showError('registerError', '비밀번호는 6자 이상이어야 합니다.');
        return;
    }
    
    // 로딩 상태 표시
    setLoadingState('registerBtn', true);
    
    try {
        // 실제로는 Flask API로 요청을 보내야 함
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registerData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('회원가입 성공:', result);
            showSuccess('registerError', '회원가입이 완료되었습니다!');
            setTimeout(() => {
                closeModal('registerModal');
                showLoginModal();
            }, 1500);
        } else {
            const error = await response.json();
            console.log('회원가입 실패:', error);
            showError('registerError', error.error || '회원가입에 실패했습니다.');
        }
    } catch (error) {
        console.error('회원가입 오류:', error);
        showError('registerError', '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
        // 로딩 상태 해제
        setLoadingState('registerBtn', false);
    }
}

// 사용자 인터페이스 업데이트 (로그인 후)
function updateUserInterface(user) {
    // 사용자 정보를 전역 변수로 저장
    window.currentUser = user;
    
    const authButtons = document.querySelector('.auth-buttons');
    authButtons.innerHTML = `
        <div class="user-info">
            <span>안녕하세요, ${user.nickname}님!</span>
            <button class="btn btn-outline" onclick="showMyPage()">마이페이지</button>
            <button class="btn btn-outline" onclick="logout()">로그아웃</button>
        </div>
    `;
}

// 마이페이지 표시
function showMyPage() {
    // 현재 사용자 정보를 마이페이지에 표시
    if (window.currentUser) {
        document.getElementById('profileEmail').textContent = window.currentUser.email;
        document.getElementById('profileNickname').textContent = window.currentUser.nickname;
        document.getElementById('profileMoney').textContent = window.currentUser.money.toLocaleString() + '원';
    }
    document.getElementById('myPageModal').style.display = 'block';
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
    
    // 로그아웃 확인 모달 생성
    const modal = document.createElement('div');
    modal.id = 'logoutModal';
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <h2>로그아웃</h2>
            <p>정말 로그아웃 하시겠습니까?</p>
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
function confirmLogout() {
    showNotification('로그아웃 되었습니다.', 'success');
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// 최신 상품 로드
async function loadLatestProducts() {
    try {
        const response = await fetch('/api/products');
        if (response.ok) {
            const result = await response.json();
            displayProducts(result.products);
        } else {
            // API 실패 시 빈 상품 목록 표시
            displayProducts([]);
        }
    } catch (error) {
        console.error('상품 로드 오류:', error);
        // 오류 시 빈 상품 목록 표시
        displayProducts([]);
    }
}

// 상품 표시
function displayProducts(products) {
    console.log('상품 표시 함수 호출됨:', products);
    const productGrid = document.querySelector('.product-grid');
    
    if (!productGrid) {
        console.error('product-grid 요소를 찾을 수 없습니다!');
        return;
    }
    
    console.log('상품 그리드 찾음:', productGrid);
    
    if (!products || products.length === 0) {
        productGrid.innerHTML = '<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #666; font-size: 1.5rem; font-weight: 500; text-align: center; z-index: 1;">등록된 상품이 없습니다.</div>';
        return;
    }
    
    productGrid.innerHTML = products.map(product => `
        <div class="product-card" onclick="viewProduct(${product.id})">
            <div class="product-image">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.title}">` : 
                    '📦'}
            </div>
            <div class="product-info">
                <div class="product-title">${product.title}</div>
                <div class="product-price">${typeof product.price === 'number' ? 
                    product.price.toLocaleString() + '원' : product.price}</div>
                <div class="product-location">${product.delivery_method || '배송 정보 없음'}</div>
            </div>
        </div>
    `).join('');
    
    console.log('상품 HTML 생성 완료');
}

// 상품 상세보기
function viewProduct(productId) {
    // 상품 상세 페이지로 이동
    window.location.href = `/product/${productId}`;
}

// 상품 상세 정보 로드
async function loadProductDetail() {
    const productId = getProductIdFromUrl();
    if (!productId) {
        showNotification('상품 ID를 찾을 수 없습니다.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/products/${productId}`);
        if (response.ok) {
            const result = await response.json();
            displayProductDetail(result.product);
        } else {
            const error = await response.json();
            showNotification('상품을 불러올 수 없습니다: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('상품 상세 로드 오류:', error);
        showNotification('상품 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// URL에서 상품 ID 추출
function getProductIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/product\/(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// 상품 상세 정보 표시
function displayProductDetail(product) {
    const productDetail = document.getElementById('productDetail');
    if (!productDetail) return;
    
    const createdDate = new Date(product.created_at).toLocaleDateString('ko-KR');
    
    productDetail.innerHTML = `
        <div class="product-detail-header">
            <div class="product-detail-image">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.title}">` : 
                    '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 4rem;">📦</div>'
                }
            </div>
            <div class="product-detail-info">
                <h1 class="product-detail-title">${product.title}</h1>
                <div class="product-detail-price">${product.price.toLocaleString()}원</div>
                <div class="product-detail-meta">
                    <div class="meta-item">
                        <i class="fas fa-truck"></i>
                        <span>${product.delivery_method || '배송 정보 없음'}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-user"></i>
                        <span>판매자: ${product.seller_nickname}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>등록일: ${createdDate}</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="product-detail-description">
            <h3>상품 설명</h3>
            <p>${product.description || '상품 설명이 없습니다.'}</p>
        </div>
        <div class="product-detail-actions">
            <button class="btn btn-outline" onclick="showPurchaseModal(${product.id}, '${product.title}', ${product.price})">
                💰 구매하기
            </button>
            <button class="btn btn-primary" onclick="showNotification('관심 상품으로 추가되었습니다!', 'success')">
                ❤️ 관심상품
            </button>
        </div>
    `;
}

// 구매 모달 표시
function showPurchaseModal(productId, productTitle, productPrice) {
    const purchaseInfo = document.getElementById('purchaseInfo');
    if (purchaseInfo) {
        purchaseInfo.innerHTML = `
            <div style="text-align: center; margin-bottom: 1rem;">
                <h3>${productTitle}</h3>
                <div style="font-size: 1.5rem; color: #8B4513; font-weight: bold; margin: 1rem 0;">
                    ${productPrice.toLocaleString()}원
                </div>
                <p style="color: #666;">구매하시겠습니까?</p>
            </div>
        `;
    }
    document.getElementById('purchaseModal').style.display = 'block';
}

// 구매 확인
function confirmPurchase() {
    showNotification('구매 기능은 추후 구현될 예정입니다.', 'info');
    closeModal('purchaseModal');
}

// 뒤로가기
function goBack() {
    window.history.back();
}

// 페이지 로드 시 상품 상세 정보 로드
if (window.location.pathname.includes('/product/')) {
    document.addEventListener('DOMContentLoaded', function() {
        loadProductDetail();
    });
}

// 검색 기능
function setupSearch() {
    const searchInput = document.querySelector('.search-box input');
    const searchButton = document.querySelector('.search-box button');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
}

// 검색 실행
function performSearch() {
    const searchInput = document.querySelector('.search-box input');
    const query = searchInput.value.trim();
    
    if (query) {
        showNotification(`"${query}" 검색 기능은 추후 구현될 예정입니다.`, 'info');
    }
}

// 카테고리 클릭 이벤트
function setupCategoryEvents() {
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.addEventListener('click', function() {
            const category = this.querySelector('span').textContent;
            showNotification(`${category} 카테고리 페이지는 추후 구현될 예정입니다.`, 'info');
        });
    });
}

// 유틸리티 함수들

// 에러 메시지 표시
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.className = 'error-message';
        errorElement.style.display = 'block';
    }
}

// 성공 메시지 표시
function showSuccess(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.className = 'success-message';
        errorElement.style.display = 'block';
    }
}

// 에러 메시지 숨기기
function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

// 로딩 상태 설정
function setLoadingState(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (button) {
        const textElement = document.getElementById(buttonId.replace('Btn', 'BtnText'));
        const loadingElement = document.getElementById(buttonId.replace('Btn', 'BtnLoading'));
        
        if (isLoading) {
            button.disabled = true;
            if (textElement) textElement.style.display = 'none';
            if (loadingElement) loadingElement.style.display = 'inline';
        } else {
            button.disabled = false;
            if (textElement) textElement.style.display = 'inline';
            if (loadingElement) loadingElement.style.display = 'none';
        }
    }
}

// 알림 메시지 표시
function showNotification(message, type = 'info') {
    // 기존 알림이 있다면 제거
    const existingNotification = document.getElementById('notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 알림 요소 생성
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 스타일 적용
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 5px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease-out;
    `;
    
    // 타입별 색상 설정
    if (type === 'success') {
        notification.style.background = '#28a745';
    } else if (type === 'error') {
        notification.style.background = '#dc3545';
    } else if (type === 'warning') {
        notification.style.background = '#ffc107';
        notification.style.color = '#333';
    } else { // info
        notification.style.background = '#17a2b8';
    }
    
    // body에 추가
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

// 충전 금액 설정
function setChargeAmount(amount) {
    document.getElementById('chargeAmount').value = amount;
    
    // 모든 옵션 버튼에서 active 클래스 제거
    document.querySelectorAll('.charge-option').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 클릭된 버튼에 active 클래스 추가
    event.target.classList.add('active');
}

// 충전 모달 표시
function showChargeModal() {
    document.getElementById('chargeModal').style.display = 'block';
    closeModal('myPageModal');
}

// 상품 등록 모달 표시
function showProductRegister() {
    document.getElementById('productModal').style.display = 'block';
    closeModal('myPageModal');
}

// 충전 처리
async function handleCharge(event) {
    event.preventDefault();
    
    // 에러 메시지 숨기기
    hideError('chargeError');
    
    const formData = new FormData(event.target);
    const amount = parseInt(formData.get('amount'));
    
    if (!amount || amount < 1000) {
        showError('chargeError', '최소 1,000원 이상 충전해주세요.');
        return;
    }
    
    // 로딩 상태 표시
    setLoadingState('chargeBtn', true);
    
    try {
        // 사용자 ID를 포함하여 API 요청
        const response = await fetch('/api/charge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                amount: amount,
                user_id: window.currentUser ? window.currentUser.id : null
            })
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
            showError('chargeError', '충전 실패: ' + error.error);
        }
    } catch (error) {
        console.error('충전 오류:', error);
        showError('chargeError', '충전 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
        setLoadingState('chargeBtn', false);
    }
}

// 상품 등록 처리
async function handleProductRegister(event) {
    event.preventDefault();
    
    // 에러 메시지 숨기기
    hideError('productError');
    
    const formData = new FormData(event.target);
    
    // 필수 필드 검증
    if (!formData.get('title') || !formData.get('price') || !formData.get('delivery') || !formData.get('description')) {
        showError('productError', '모든 필드를 입력해주세요.');
        return;
    }
    
    if (!formData.get('image') || formData.get('image').size === 0) {
        showError('productError', '상품 이미지를 선택해주세요.');
        return;
    }
    
    // 로딩 상태 표시
    setLoadingState('productBtn', true);
    
    try {
        // 사용자 ID 추가
        if (window.currentUser) {
            formData.append('seller_id', window.currentUser.id);
        }
        
        const response = await fetch('/api/products', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccess('productError', '상품이 성공적으로 등록되었습니다!');
            setTimeout(() => {
                closeModal('productModal');
                // 폼 초기화
                document.getElementById('productForm').reset();
                document.getElementById('imagePreview').style.display = 'none';
                // 상품 목록 새로고침
                loadLatestProducts();
            }, 1500);
        } else {
            const error = await response.json();
            showError('productError', error.error || '상품 등록에 실패했습니다.');
        }
    } catch (error) {
        console.error('상품 등록 오류:', error);
        showError('productError', '상품 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
        setLoadingState('productBtn', false);
    }
}

// 이미지 미리보기
function setupImagePreview() {
    const imageInput = document.getElementById('productImage');
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
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
        });
    }
}

// 페이지 로드 시 추가 이벤트 설정
document.addEventListener('DOMContentLoaded', function() {
    setupSearch();
    setupCategoryEvents();
    setupImagePreview();
    
    // 충전 폼 이벤트 리스너 추가
    const chargeForm = document.getElementById('chargeForm');
    if (chargeForm) {
        chargeForm.addEventListener('submit', handleCharge);
    }
    
    // 상품 등록 폼 이벤트 리스너 추가
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', handleProductRegister);
    }
});
