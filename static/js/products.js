// 전역 변수
let currentCategory = 'all';
let currentPage = 1;
let currentSoldPage = 1;
const perPage = 12;

// 상품 페이지 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeProductsPage();
});

// 상품 페이지 초기화
async function initializeProductsPage() {
    try {
        // 카테고리 통계 로드
        await loadCategoryStats();
        
        // 등록된 상품 로드
        await loadProductsByCategory('all', 1);
        
        // 거래완료 상품 로드
        await loadSoldProducts(1);
        
        // 카테고리 네비게이션 설정
        setupCategoryNavigation();
        
    } catch (error) {
        console.error('상품 페이지 초기화 오류:', error);
    }
}

// 카테고리 통계 로드
async function loadCategoryStats() {
    try {
        const response = await fetch('/api/products/category-stats');
        if (response.ok) {
            const result = await response.json();
            updateCategoryCounts(result.stats);
        } else {
            console.error('카테고리 통계 로드 실패');
        }
    } catch (error) {
        console.error('카테고리 통계 로드 오류:', error);
    }
}

// 카테고리별 상품 수 업데이트
function updateCategoryCounts(stats) {
    // 전체 상품 수
    const allCount = document.getElementById('count-all');
    if (allCount) {
        allCount.textContent = stats.all || 0;
    }
    
    // 각 카테고리별 상품 수
    const categories = ['전자기기', '의류', '기타'];
    categories.forEach(category => {
        const countElement = document.getElementById(`count-${category}`);
        if (countElement) {
            countElement.textContent = stats[category] || 0;
        }
    });
}

// 카테고리별 상품 로드
async function loadProductsByCategory(category, page = 1) {
    try {
        const response = await fetch(`/api/products/category/${category}?page=${page}&per_page=${perPage}`);
        if (response.ok) {
            const result = await response.json();
            displayProducts(result.products);
            updateProductsHeader(category, result.total);
            displayPagination('productsPagination', result);
            currentCategory = category;
            currentPage = page;
        } else {
            console.error('카테고리별 상품 로드 실패');
            displayProducts([]);
        }
    } catch (error) {
        console.error('카테고리별 상품 로드 오류:', error);
        displayProducts([]);
    }
}

// 거래완료 상품 로드
async function loadSoldProducts(page = 1) {
    try {
        const response = await fetch(`/api/sold-products/paged?page=${page}&per_page=${perPage}`);
        if (response.ok) {
            const result = await response.json();
            displaySoldProducts(result.products);
            updateSoldProductsHeader(result.total);
            displayPagination('soldProductsPagination', result);
            currentSoldPage = page;
        } else {
            console.error('거래완료 상품 로드 실패');
            displaySoldProducts([]);
        }
    } catch (error) {
        console.error('거래완료 상품 로드 오류:', error);
        displaySoldProducts([]);
    }
}

// 카테고리별 거래완료 상품 로드
async function loadSoldProductsByCategory(category, page = 1) {
    try {
        let url = `/api/sold-products/paged?page=${page}&per_page=${perPage}`;
        if (category !== 'all') {
            url += `&category=${encodeURIComponent(category)}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
            const result = await response.json();
            displaySoldProducts(result.products);
            updateSoldProductsHeader(result.total);
            displayPagination('soldProductsPagination', result);
            currentSoldPage = page;
        } else {
            console.error('거래완료 상품 로드 실패');
            displaySoldProducts([]);
        }
    } catch (error) {
        console.error('거래완료 상품 로드 오류:', error);
        displaySoldProducts([]);
    }
}

// 상품 목록 표시
function displayProducts(products) {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) {
        console.error('productsGrid 요소를 찾을 수 없습니다!');
        return;
    }

    if (!products || products.length === 0) {
        productsGrid.classList.add('empty-state');
        productsGrid.innerHTML = '<div style="color: #666; font-size: 1.2rem;">등록된 상품이 없습니다.</div>';
        return;
    }
    
    productsGrid.classList.remove('empty-state');

    productsGrid.innerHTML = products.map(product => {
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

// 거래완료 상품 표시
function displaySoldProducts(products) {
    const soldProductsGrid = document.getElementById('soldProductsGrid');
    if (!soldProductsGrid) {
        console.error('soldProductsGrid 요소를 찾을 수 없습니다!');
        return;
    }

    if (!products || products.length === 0) {
        soldProductsGrid.classList.add('empty-state');
        soldProductsGrid.innerHTML = '<div style="color: #666; font-size: 1.2rem;">거래완료된 상품이 없습니다.</div>';
        return;
    }
    
    soldProductsGrid.classList.remove('empty-state');

    soldProductsGrid.innerHTML = products.map(product => {
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

// 상품 헤더 업데이트
function updateProductsHeader(category, total) {
    const categoryTitle = document.getElementById('category-title');
    const productsCount = document.getElementById('products-count');
    
    if (categoryTitle) {
        const categoryNames = {
            'all': '등록된 상품',
            '전자기기': '전자기기',
            '의류': '의류',
            '기타': '기타'
        };
        categoryTitle.textContent = categoryNames[category] || category;
    }
    
    if (productsCount) {
        productsCount.textContent = `총 ${total}개 상품`;
    }
}

// 거래완료 상품 헤더 업데이트
function updateSoldProductsHeader(total) {
    const soldProductsCount = document.getElementById('sold-products-count');
    if (soldProductsCount) {
        soldProductsCount.textContent = `총 ${total}개 상품`;
    }
}

// 페이징 표시
function displayPagination(containerId, paginationData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { page, total_pages, has_prev, has_next } = paginationData;
    
    if (total_pages <= 1) {
        container.innerHTML = '';
        return;
    }

    let paginationHTML = '<div class="pagination-controls">';
    
    // 이전 버튼
    if (has_prev) {
        paginationHTML += `<button class="pagination-btn prev" onclick="changePage(${page - 1}, '${containerId}')">
            <i class="fas fa-chevron-left"></i> 이전
        </button>`;
    }
    
    // 페이지 번호들
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(total_pages, page + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="changePage(1, '${containerId}')">1</button>`;
        if (startPage > 2) {
            paginationHTML += '<span class="pagination-ellipsis">...</span>';
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === page ? 'active' : '';
        paginationHTML += `<button class="pagination-btn ${isActive}" onclick="changePage(${i}, '${containerId}')">${i}</button>`;
    }
    
    if (endPage < total_pages) {
        if (endPage < total_pages - 1) {
            paginationHTML += '<span class="pagination-ellipsis">...</span>';
        }
        paginationHTML += `<button class="pagination-btn" onclick="changePage(${total_pages}, '${containerId}')">${total_pages}</button>`;
    }
    
    // 다음 버튼
    if (has_next) {
        paginationHTML += `<button class="pagination-btn next" onclick="changePage(${page + 1}, '${containerId}')">
            다음 <i class="fas fa-chevron-right"></i>
        </button>`;
    }
    
    paginationHTML += '</div>';
    container.innerHTML = paginationHTML;
}

// 페이지 변경
function changePage(page, containerId) {
    if (containerId === 'productsPagination') {
        loadProductsByCategory(currentCategory, page);
    } else if (containerId === 'soldProductsPagination') {
        loadSoldProducts(page);
    }
}

// 카테고리 네비게이션 설정
function setupCategoryNavigation() {
    const categoryItems = document.querySelectorAll('.category-item');
    
    categoryItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            const category = this.getAttribute('data-category');
            
            // 모든 카테고리 아이템에서 active 클래스 제거
            categoryItems.forEach(cat => cat.classList.remove('active'));
            // 클릭된 카테고리에 active 클래스 추가
            this.classList.add('active');
            
            // 현재 카테고리 업데이트
            currentCategory = category;
            
            // 해당 카테고리 상품 로드 (첫 페이지로)
            loadProductsByCategory(category, 1);
            
            // 해당 카테고리 거래완료 상품도 로드 (첫 페이지로)
            loadSoldProductsByCategory(category, 1);
        });
    });
}

// 상품 상세 페이지로 이동
function goToProductDetail(productId) {
    window.location.href = `/product/${productId}`;
}
