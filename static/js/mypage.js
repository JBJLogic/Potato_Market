// 마이페이지 JavaScript

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeMyPage();
});

// 마이페이지 초기화
async function initializeMyPage() {
    await checkSessionStatus();
    setupTabNavigation();
    // checkSessionStatus에서 이미 loadUserProfile()이 호출됨
}

// 세션 상태 확인
async function checkSessionStatus() {
    try {
        console.log('세션 상태 확인 중...');
        const response = await fetch('/api/check-session');
        console.log('세션 응답:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('세션 결과:', result);
            
            if (result.logged_in) {
                console.log('로그인됨, 사용자 정보:', result.user);
                updateUserInterface(result.user);
                // localStorage에도 저장 (백업용)
                localStorage.setItem('user', JSON.stringify(result.user));
            } else {
                console.log('로그인되지 않음, localStorage 확인');
                // 세션 확인 실패 시 localStorage 확인
                checkLoginStatus();
            }
        } else {
            console.log('세션 응답 실패, localStorage 확인');
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
        // localStorage에도 없으면 메인 페이지로 리다이렉트
        window.location.href = '/';
    }
}

// 사용자 인터페이스 업데이트
function updateUserInterface(user) {
    if (user) {
        window.currentUser = user;
        // 프로필 정보 업데이트
        loadUserProfile();
        // 헤더의 로그인 상태도 업데이트
        updateHeaderInterface(user);
    }
}

// 헤더 인터페이스 업데이트
function updateHeaderInterface(user) {
    console.log('헤더 인터페이스 업데이트 시작, 사용자:', user);
    
    const authButtons = document.querySelector('.auth-buttons');
    console.log('헤더 auth-buttons 요소:', authButtons);
    
    if (authButtons && user) {
        const newHTML = `
            <div class="user-info">
                <span>안녕하세요, ${user.nickname}님!</span>
                <button class="btn btn-outline" onclick="showMyPage()">마이페이지</button>
                <button class="btn btn-outline" onclick="logout()">로그아웃</button>
            </div>
        `;
        
        authButtons.innerHTML = newHTML;
        console.log('헤더 인터페이스 업데이트 완료, HTML:', newHTML);
        
        // 업데이트 후 확인
        setTimeout(() => {
            const updatedAuthButtons = document.querySelector('.auth-buttons');
            console.log('업데이트 후 헤더 상태:', updatedAuthButtons.innerHTML);
        }, 100);
    } else {
        console.error('헤더 요소를 찾을 수 없습니다:', { authButtons, user });
    }
}

// 웹 최적화 네비게이션 설정
function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            
            // 모든 네비게이션 아이템에서 active 클래스 제거
            navItems.forEach(nav => nav.classList.remove('active'));
            // 클릭된 네비게이션 아이템에 active 클래스 추가
            this.classList.add('active');
            
            // 모든 콘텐츠 섹션에서 active 클래스 제거
            contentSections.forEach(section => section.classList.remove('active'));
            // 해당 콘텐츠 섹션에 active 클래스 추가
            document.getElementById(sectionId).classList.add('active');
            
            // 섹션별 데이터 로드
            if (sectionId === 'products') {
                loadMyProducts();
            }
        });
    });
}

// 사용자 프로필 로드
function loadUserProfile() {
    console.log('프로필 로드 시작, 현재 사용자:', window.currentUser);
    
    if (window.currentUser) {
        const emailElement = document.getElementById('profileEmail');
        const nicknameElement = document.getElementById('profileNickname');
        const moneyElement = document.getElementById('profileMoney');
        
        console.log('프로필 요소들:', { emailElement, nicknameElement, moneyElement });
        
        if (emailElement) {
            emailElement.textContent = window.currentUser.email;
            console.log('이메일 설정:', window.currentUser.email);
        }
        if (nicknameElement) {
            nicknameElement.textContent = window.currentUser.nickname;
            console.log('닉네임 설정:', window.currentUser.nickname);
        }
        if (moneyElement) {
            moneyElement.textContent = window.currentUser.money.toLocaleString() + '원';
            console.log('금액 설정:', window.currentUser.money);
        }
    } else {
        console.error('사용자 정보가 없습니다.');
    }
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

// 웹 최적화 상품 목록 표시
function displayMyProducts(products) {
    const myProductsList = document.getElementById('myProductsList');
    if (!myProductsList) return;
    
    if (!products || products.length === 0) {
        myProductsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box"></i>
                <h3>등록한 상품이 없습니다</h3>
                <p>아직 등록한 상품이 없습니다. 첫 번째 상품을 등록해보세요!</p>
            </div>
        `;
        return;
    }
    
    myProductsList.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>이미지</th>
                    <th>상품명</th>
                    <th>가격</th>
                    <th>상태</th>
                    <th>등록일</th>
                    <th>관리</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(product => `
                    <tr>
                        <td class="product-image-cell">
                            ${product.image_url ? 
                                `<img src="${product.image_url}" alt="${product.title}">` : 
                                '<div style="width: 60px; height: 60px; background: #f8f9fa; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #999;">📦</div>'
                            }
                        </td>
                        <td class="product-title-cell">
                            <div class="product-title">${product.title}</div>
                        </td>
                        <td class="product-price-cell">
                            <div class="product-price">${product.price.toLocaleString()}원</div>
                        </td>
                        <td class="product-status-cell">
                            <span class="status-badge ${product.is_sold ? 'sold' : 'available'}">
                                ${product.is_sold ? '판매완료' : '판매중'}
                            </span>
                        </td>
                        <td class="product-date-cell">
                            ${new Date(product.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td class="product-actions-cell">
                            <div class="action-buttons">
                                <button class="btn btn-outline" onclick="viewProduct(${product.id})">보기</button>
                                <button class="btn btn-primary" onclick="editProduct(${product.id})">수정</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// 구매한 상품 목록 로드 (임시)
function loadPurchasedProducts() {
    const purchasedProductsList = document.getElementById('purchasedProductsList');
    if (purchasedProductsList) {
        purchasedProductsList.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 1rem; color: #ddd;"></i>
                <h3>구매 기능 준비 중</h3>
                <p>구매 기능은 추후 구현될 예정입니다.</p>
            </div>
        `;
    }
}

// 모달 관련 함수들 (기존 global.js에서 가져옴)
function showProductRegister() {
    document.getElementById('productModal').style.display = 'block';
}

function showChargeModal() {
    document.getElementById('chargeModal').style.display = 'block';
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
                window.location.href = '/';
            }, 1000);
        } else {
            showNotification('로그아웃 중 오류가 발생했습니다.', 'error');
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
        showNotification('로그아웃 중 오류가 발생했습니다.', 'error');
    }
}

// 알림 표시 함수
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

// 상품 보기
function viewProduct(productId) {
    window.location.href = `/product/${productId}`;
}

// 상품 수정 (임시)
function editProduct(productId) {
    showNotification('상품 수정 기능은 추후 구현될 예정입니다.', 'info');
}

// 뒤로가기
function goBack() {
    window.history.back();
}
