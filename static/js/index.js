// 메인 페이지 JavaScript

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    // DOM이 완전히 로드된 후 실행되도록 약간의 지연
    setTimeout(() => {
        initializeApp();
    }, 50);
});

// 앱 초기화
function initializeApp() {
    setupMainSearchBar();
    // URL에 search 파라미터가 있으면 자연어 검색 결과 표시
    const params = new URLSearchParams(window.location.search);
    const nlQuery = params.get('search');
    if (nlQuery && nlQuery.trim()) {
        showSearchResults(nlQuery.trim());
    }
}

// 메인 검색바 설정
function setupMainSearchBar() {
    const searchInput = document.getElementById('mainSearchInput');
    const searchBtn = document.querySelector('.main-search-btn');
    
    if (searchInput) {
        // textarea: Ctrl+Enter로 검색, Enter는 줄바꿈 유지
        searchInput.addEventListener('keydown', function(e) {
            const isEnter = e.key === 'Enter';
            const isCtrl = e.ctrlKey || e.metaKey;
            if (isEnter && isCtrl) {
                e.preventDefault();
                performMainSearch();
            }
        });
    }
    
    if (searchBtn) {
        // 검색 버튼 클릭
        searchBtn.addEventListener('click', performMainSearch);
    }
}

// 메인 검색 실행
function performMainSearch() {
    const searchTerm = document.getElementById('mainSearchInput').value.trim();
    
    if (!searchTerm) {
        alert('검색어를 입력해주세요.');
        return;
    }
    
    console.log('검색어:', searchTerm);
    // 메인에서 바로 자연어 검색 결과 표시
    const url = new URL(window.location.href);
    url.searchParams.set('search', searchTerm);
    window.history.replaceState({}, '', url.toString());
    showSearchResults(searchTerm);
}



// 최신 상품 로드
async function loadLatestProducts() {
    try {
        const response = await fetch('/api/products');
        if (response.ok) {
            const result = await response.json();
            displayProducts(result.products);
        } else {
            console.error('상품 로드 실패');
        }
    } catch (error) {
        console.error('상품 로드 오류:', error);
    }
}

// 상품 목록 표시
function displayProducts(products) {
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) {
        console.error('productGrid 요소를 찾을 수 없습니다!');
        return;
    }
    
    if (!products || products.length === 0) {
        productGrid.classList.add('empty-state');
        productGrid.innerHTML = '<div style="color: #666; font-size: 1.2rem;">등록된 상품이 없습니다.</div>';
        return;
    }
    
    productGrid.classList.remove('empty-state');
    
    productGrid.innerHTML = products.map(product => {
        // 상품 제목이 없거나 undefined인 경우 처리
        const productTitle = product.title || '상품명 없음';
        const isSold = product.is_sold || false;
        
        return `
            <div class="product-card ${isSold ? 'sold-product' : ''}" onclick="goToProductDetail(${product.id})">
                <div class="product-image">
                    ${product.image_url ? 
                        `<img src="${product.image_url}" alt="${productTitle}">` : 
                        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 3rem;">📦</div>'
                    }
                    ${isSold ? '<div class="sold-overlay">거래 완료</div>' : ''}
                </div>
                <div class="product-info">
                    <p class="product-title">${productTitle}</p>
                    <p class="product-price">${product.price ? product.price.toLocaleString() : '0'}원</p>
                    <p class="product-location">${product.delivery_method || '배송 정보 없음'}</p>
                </div>
            </div>
        `;
    }).join('');
}

// 자연어 검색 결과 표시
async function showSearchResults(query) {
    const section = document.getElementById('searchResultsSection');
    const title = document.getElementById('searchResultsTitle');
    if (section && title) {
        section.style.display = 'block';
        title.textContent = `검색 결과: "${query}"`;
    }
    try {
        const res = await fetch(`/api/search/nl?q=${encodeURIComponent(query)}`);
        if (res.ok) {
            const data = await res.json();
            displayProducts(data.products || []);
        } else {
            displayProducts([]);
        }
    } catch (e) {
        console.error('자연어 검색 오류:', e);
        displayProducts([]);
    }
}

// 거래완료 상품 로드
async function loadSoldProducts() {
    try {
        const response = await fetch('/api/sold-products');
        if (response.ok) {
            const result = await response.json();
            displaySoldProducts(result.products);
        } else {
            console.error('거래완료 상품 로드 실패');
        }
    } catch (error) {
        console.error('거래완료 상품 로드 오류:', error);
    }
}

// 거래완료 상품 표시
function displaySoldProducts(products) {
    const soldProductGrid = document.getElementById('soldProductGrid');
    if (!soldProductGrid) {
        console.error('soldProductGrid 요소를 찾을 수 없습니다!');
        return;
    }
    
    if (!products || products.length === 0) {
        soldProductGrid.classList.add('empty-state');
        soldProductGrid.innerHTML = '<div style="color: #666; font-size: 1.2rem;">거래완료된 상품이 없습니다.</div>';
        return;
    }
    
    soldProductGrid.classList.remove('empty-state');
    
    soldProductGrid.innerHTML = products.map(product => {
        const productTitle = product.title || '상품명 없음';
        
        return `
            <div class="product-card sold-product" onclick="goToProductDetail(${product.id})">
                <div class="product-image">
                    ${product.image_url ? 
                        `<img src="${product.image_url}" alt="${productTitle}">` : 
                        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 3rem;">📦</div>'
                    }
                    <div class="sold-overlay">거래 완료</div>
                </div>
                <div class="product-info">
                    <p class="product-title">${productTitle}</p>
                    <p class="product-price">${product.price ? product.price.toLocaleString() : '0'}원</p>
                    <p class="product-location">${product.delivery_method || '배송 정보 없음'}</p>
                </div>
            </div>
        `;
    }).join('');
}

// 상품 상세 페이지로 이동
function goToProductDetail(productId) {
    window.location.href = `/product/${productId}`;
}

// 뒤로가기
function goBack() {
    window.history.back();
}