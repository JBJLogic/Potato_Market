// 전역 변수
let currentCategory = 'all';
let currentPage = 1;
let currentSoldPage = 1;
const perPage = 5;

// 상품 페이지 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeProductsPage();
});

// 상품 페이지 초기화
async function initializeProductsPage() {
    try {
        const params = new URLSearchParams(window.location.search);
        const nlQuery = params.get('search');

        if (nlQuery && nlQuery.trim().length > 0) {
            // 자연어 검색 경로
            await loadProductsByNL(nlQuery.trim());
        } else {
            // 기본 카테고리 뷰 경로
            await loadCategoryStats();
            await loadProductsByCategory('all', 1);
            await loadSoldProducts(1);
            setupCategoryNavigation();
        }
        
    } catch (error) {
        console.error('상품 페이지 초기화 오류:', error);
    }
}

// 자연어 검색 결과 로드
async function loadProductsByNL(query) {
    try {
        const response = await fetch(`/api/search/nl?q=${encodeURIComponent(query)}`);
        if (response.ok) {
            const result = await response.json();
            displayProducts(result.products);
            updateProductsHeader('자연어 검색 결과', result.total || 0);
            // 자연어 모드에서는 거래완료/페이징 영역을 비워줌
            const soldList = document.getElementById('soldProductsList');
            if (soldList) soldList.innerHTML = '<tr><td colspan="6" class="empty-state">자연어 검색 모드</td></tr>';
            const soldPagination = document.getElementById('soldProductsPagination');
            if (soldPagination) soldPagination.innerHTML = '';
            const productsPagination = document.getElementById('productsPagination');
            if (productsPagination) productsPagination.innerHTML = '';
        } else {
            displayProducts([]);
        }
    } catch (e) {
        console.error('자연어 검색 로드 오류:', e);
        displayProducts([]);
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

// 상품 목록 표시 (테이블 형태)
function displayProducts(products) {
    const productsList = document.getElementById('productsList');
    if (!productsList) {
        console.error('productsList 요소를 찾을 수 없습니다!');
        return;
    }

    if (!products || products.length === 0) {
        productsList.innerHTML = '<tr><td colspan="6" class="empty-state">등록된 상품이 없습니다</td></tr>';
        return;
    }

    productsList.innerHTML = products.map(product => {
        const productTitle = product.title || '상품명 없음';
        const isSold = product.is_sold || false;
        const createdDate = new Date(product.created_at).toLocaleDateString('ko-KR');

        return `
            <tr class="product-row" onclick="goToProductDetail(${product.id})">
                <td class="product-title">${productTitle}</td>
                <td class="product-price">${product.price ? product.price.toLocaleString() : '0'}원</td>
                <td class="product-category">${product.category || '기타'}</td>
                <td class="product-delivery">${product.delivery_method || '배송 정보 없음'}</td>
                <td class="product-date">${createdDate}</td>
                <td class="product-status">
                    ${isSold ? 
                        '<span class="status-sold">거래완료</span>' : 
                        '<span class="status-available">판매중</span>'
                    }
                </td>
            </tr>
        `;
    }).join('');
}

// 거래완료 상품 표시 (테이블 형태)
function displaySoldProducts(products) {
    const soldProductsList = document.getElementById('soldProductsList');
    if (!soldProductsList) {
        console.error('soldProductsList 요소를 찾을 수 없습니다!');
        return;
    }

    if (!products || products.length === 0) {
        soldProductsList.innerHTML = '<tr><td colspan="6" class="empty-state">거래완료된 상품이 없습니다</td></tr>';
        return;
    }

    soldProductsList.innerHTML = products.map(product => {
        const productTitle = product.title || '상품명 없음';
        const createdDate = new Date(product.created_at).toLocaleDateString('ko-KR');

        return `
            <tr class="product-row" onclick="goToProductDetail(${product.id})">
                <td class="product-title">${productTitle}</td>
                <td class="product-price">${product.price ? product.price.toLocaleString() : '0'}원</td>
                <td class="product-category">${product.category || '기타'}</td>
                <td class="product-delivery">${product.delivery_method || '배송 정보 없음'}</td>
                <td class="product-date">${createdDate}</td>
                <td class="product-status">
                    <span class="status-sold">거래완료</span>
                </td>
            </tr>
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

// 테이블에서는 높이 조정이 필요하지 않음

// 상품 상세 페이지로 이동
function goToProductDetail(productId) {
    window.location.href = `/product/${productId}`;
}
