// admin_products.js
let currentPage = 1;
const perPage = 20;
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', function() {
    loadProducts();
});

// 상품 목록 로드
async function loadProducts(page = 1, category = 'all') {
    currentPage = page;
    currentCategory = category;

    const productsTableBody = document.getElementById('productsTableBody');
    const emptyState = document.getElementById('emptyState');
    const totalProductsCount = document.getElementById('totalProductsCount');
    const currentCategorySpan = document.getElementById('currentCategory');

    productsTableBody.innerHTML = '<tr><td colspan="7" class="loading-state"><i class="fas fa-spinner fa-spin"></i> 상품 정보를 불러오는 중...</td></tr>';
    emptyState.style.display = 'none';

    try {
        let url = `/api/admin/products?page=${page}&per_page=${perPage}`;
        if (category !== 'all') {
            url += `&category=${encodeURIComponent(category)}`;
        }

        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            if (response.status === 403) {
                showNotification('관리자 권한이 필요합니다.', 'error');
                window.location.href = '/'; // 메인 페이지로 리다이렉트
                return;
            }
            const errorData = await response.json();
            throw new Error(`상품 목록 로드 실패: ${errorData.error || '알 수 없는 오류'}`);
        }
        const result = await response.json();

        displayProducts(result.products);
        displayPagination(result.total_pages);
        updateStats(result.total, category);

        if (result.products.length === 0) {
            emptyState.style.display = 'block';
            productsTableBody.innerHTML = '';
        } else {
            emptyState.style.display = 'none';
        }

    } catch (error) {
        console.error('상품 목록 로드 오류:', error);
        productsTableBody.innerHTML = '<tr><td colspan="7" class="error-state"><i class="fas fa-exclamation-circle"></i> 상품 정보를 불러올 수 없습니다.</td></tr>';
        showNotification('상품 목록을 불러오는 중 오류가 발생했습니다.', 'error');
        updateStats(0, category);
    }
}

// 통계 업데이트
function updateStats(total, category) {
    document.getElementById('totalProductsCount').textContent = total.toLocaleString();
    document.getElementById('currentCategory').textContent = category === 'all' ? '전체' : category;
}

// 상품 목록 표시
function displayProducts(products) {
    const productsTableBody = document.getElementById('productsTableBody');
    productsTableBody.innerHTML = '';

    products.forEach(product => {
        const row = productsTableBody.insertRow();
        row.className = 'product-row';
        row.onclick = () => viewProductDetail(product.PRODUCT_ID);
        row.style.cursor = 'pointer';

        row.innerHTML = `
            <td class="product-id">${product.PRODUCT_ID}</td>
            <td class="product-title">${escapeHtml(product.title)}</td>
            <td class="product-category">
                <span class="category-badge">${escapeHtml(product.category)}</span>
            </td>
            <td class="product-price">${product.price.toLocaleString()}원</td>
            <td class="product-delivery">${escapeHtml(product.delivery_method)}</td>
            <td class="product-date">${formatDate(product.created_at)}</td>
            <td class="product-actions">
                <button class="btn btn-sm btn-danger delete-btn" onclick="event.stopPropagation(); deleteProduct(${product.PRODUCT_ID}, '${escapeHtml(product.title)}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    });
}

// 페이징 표시
function displayPagination(totalPages) {
    const paginationContainer = document.getElementById('productsPagination');
    paginationContainer.innerHTML = '';

    // 페이지가 1개 이하이면 페이징 버튼 숨김
    if (totalPages <= 1) return;

    let paginationHTML = '';

    // 이전 페이지 버튼 - 첫 번째 페이지가 아니면 활성화
    if (currentPage > 1) {
        paginationHTML += `<button class="pagination-btn prev-btn" onclick="loadProducts(${currentPage - 1}, currentCategory)">
            <i class="fas fa-chevron-left"></i> 이전
        </button>`;
    } else {
        paginationHTML += `<button class="pagination-btn prev-btn disabled" disabled>
            <i class="fas fa-chevron-left"></i> 이전
        </button>`;
    }

    // 현재 페이지 정보
    paginationHTML += `<span class="page-info">${currentPage} / ${totalPages}</span>`;

    // 다음 페이지 버튼 - 마지막 페이지가 아니면 활성화
    if (currentPage < totalPages) {
        paginationHTML += `<button class="pagination-btn next-btn" onclick="loadProducts(${currentPage + 1}, currentCategory)">
            다음 <i class="fas fa-chevron-right"></i>
        </button>`;
    } else {
        paginationHTML += `<button class="pagination-btn next-btn disabled" disabled>
            다음 <i class="fas fa-chevron-right"></i>
        </button>`;
    }

    paginationContainer.innerHTML = paginationHTML;
}

// 카테고리 필터링
function filterByCategory(category) {
    // 필터 버튼 활성화 상태 변경
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');

    // 상품 목록 다시 로드
    loadProducts(1, category);
}

// 상품 상세 페이지로 이동
function viewProductDetail(productId) {
    window.location.href = `/product/${productId}`;
}

// 상품 삭제
async function deleteProduct(productId, productTitle) {
    if (!confirm(`정말로 상품 "${productTitle}"을(를) 삭제하시겠습니까?\n삭제된 상품은 복구할 수 없습니다.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(result.message, 'success');
            loadProducts(currentPage, currentCategory); // 목록 새로고침
        } else {
            const error = await response.json();
            showNotification(error.error, 'error');
        }
    } catch (error) {
        console.error('상품 삭제 오류:', error);
        showNotification('상품 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 뒤로가기 함수
function goBack() {
    window.history.back();
}

// 유틸리티 함수들
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}
