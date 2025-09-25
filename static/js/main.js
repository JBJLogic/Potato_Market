// 메인 JavaScript 파일

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 앱 초기화
function initializeApp() {
    loadLatestProducts();
    setupEventListeners();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 로그인 폼 제출
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // 회원가입 폼 제출
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
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
    
    const formData = new FormData(event.target);
    const loginData = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
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
            alert('로그인 성공!');
            closeModal('loginModal');
            // 로그인 성공 후 처리 (예: 사용자 정보 표시, 페이지 리다이렉트 등)
            updateUserInterface(result.user);
        } else {
            const error = await response.json();
            alert('로그인 실패: ' + error.message);
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        alert('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
}

// 회원가입 처리
async function handleRegister(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const registerData = {
        email: formData.get('email'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword')
    };
    
    // 비밀번호 확인
    if (registerData.password !== registerData.confirmPassword) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    
    // 비밀번호 길이 확인
    if (registerData.password.length < 6) {
        alert('비밀번호는 6자 이상이어야 합니다.');
        return;
    }
    
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
            alert('회원가입이 완료되었습니다!');
            closeModal('registerModal');
            // 회원가입 성공 후 로그인 모달로 전환
            showLoginModal();
        } else {
            const error = await response.json();
            alert('회원가입 실패: ' + error.message);
        }
    } catch (error) {
        console.error('회원가입 오류:', error);
        alert('회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
}

// 사용자 인터페이스 업데이트 (로그인 후)
function updateUserInterface(user) {
    const authButtons = document.querySelector('.auth-buttons');
    authButtons.innerHTML = `
        <div class="user-info">
            <span>안녕하세요, ${user.email}님!</span>
            <button class="btn btn-outline" onclick="showMyPage()">마이페이지</button>
            <button class="btn btn-outline" onclick="logout()">로그아웃</button>
        </div>
    `;
}

// 마이페이지 표시
function showMyPage() {
    alert('마이페이지 기능은 추후 구현될 예정입니다.');
}

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        location.reload();
    }
}

// 최신 상품 로드
async function loadLatestProducts() {
    try {
        // 실제로는 Flask API에서 상품 데이터를 가져와야 함
        const mockProducts = [
            {
                id: 1,
                title: '아이폰 13 Pro',
                price: '800,000원',
                location: '서울 강남구',
                image: '📱'
            },
            {
                id: 2,
                title: '맥북 프로 14인치',
                price: '2,500,000원',
                location: '서울 서초구',
                image: '💻'
            },
            {
                id: 3,
                title: '나이키 에어맥스',
                price: '120,000원',
                location: '서울 마포구',
                image: '👟'
            },
            {
                id: 4,
                title: '무지 후드티',
                price: '25,000원',
                location: '서울 홍대',
                image: '👕'
            }
        ];
        
        displayProducts(mockProducts);
    } catch (error) {
        console.error('상품 로드 오류:', error);
    }
}

// 상품 표시
function displayProducts(products) {
    const productGrid = document.querySelector('.product-grid');
    
    if (!productGrid) return;
    
    productGrid.innerHTML = products.map(product => `
        <div class="product-card" onclick="viewProduct(${product.id})">
            <div class="product-image">
                ${product.image}
            </div>
            <div class="product-info">
                <div class="product-title">${product.title}</div>
                <div class="product-price">${product.price}</div>
                <div class="product-location">${product.location}</div>
            </div>
        </div>
    `).join('');
}

// 상품 상세보기
function viewProduct(productId) {
    alert(`상품 ID ${productId}의 상세 페이지는 추후 구현될 예정입니다.`);
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
        alert(`"${query}" 검색 기능은 추후 구현될 예정입니다.`);
    }
}

// 카테고리 클릭 이벤트
function setupCategoryEvents() {
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.addEventListener('click', function() {
            const category = this.querySelector('span').textContent;
            alert(`${category} 카테고리 페이지는 추후 구현될 예정입니다.`);
        });
    });
}

// 페이지 로드 시 추가 이벤트 설정
document.addEventListener('DOMContentLoaded', function() {
    setupSearch();
    setupCategoryEvents();
});
