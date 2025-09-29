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
    loadLatestProducts();
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
        productGrid.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">등록된 상품이 없습니다.</p>';
        return;
    }
    
    productGrid.innerHTML = products.map(product => {
        // 상품 제목이 없거나 undefined인 경우 처리
        const productTitle = product.title || '상품명 없음';
        
        return `
            <div class="product-card" onclick="goToProductDetail(${product.id})">
                <div class="product-image">
                    ${product.image_url ? 
                        `<img src="${product.image_url}" alt="${productTitle}">` : 
                        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 3rem;">📦</div>'
                    }
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