// 상품 상세 페이지 JavaScript

// 페이지 로드 시 상품 상세 정보 로드
document.addEventListener('DOMContentLoaded', function() {
    loadProductDetail();
});

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
            // 댓글도 함께 로드
            loadComments(productId);
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
    
    // 관리자 삭제 버튼 제거 - 관리자 상품 관리 페이지에서만 삭제 가능
    
    productDetail.innerHTML = `
        <div class="product-detail-header">
            <div class="product-detail-image">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.title}">` : 
                    '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 4rem;">📦</div>'
                }
            </div>
            <div class="product-detail-info">
                <div class="product-title-row">
                    <h1 class="product-detail-title">${product.title}</h1>
                    <div class="product-actions">
                        ${product.is_sold ? 
                            '<div class="sold-status">거래완료</div>' : 
                            `<div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <button class="btn btn-primary purchase-btn" onclick="showPurchaseModal(${product.id}, '${product.title}', ${product.price})">
                                    구매하기
                                </button>
                                <button class="btn btn-outline chat-btn" onclick="startChat(${product.id})">
                                    <i class="fas fa-comments"></i> 채팅하기
                                </button>
                            </div>`
                        }
                    </div>
                </div>
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
        <div class="product-comments">
            <h3>상품 문의</h3>
            <div class="comment-form">
                <textarea id="commentText" placeholder="상품에 대해 궁금한 점을 남겨주세요..." rows="3"></textarea>
                <button class="btn btn-primary" onclick="submitComment(${product.id})">문의하기</button>
            </div>
            <div id="commentsList" class="comments-list">
                <!-- 댓글들이 여기에 표시됩니다 -->
            </div>
        </div>
    `;
}

// 구매 모달 표시
function showPurchaseModal(productId, productTitle, productPrice) {
    const purchaseModal = document.getElementById('purchaseModal');
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
    
    // 모달에 product_id 저장
    if (purchaseModal) {
        purchaseModal.setAttribute('data-product-id', productId);
    }
    
    purchaseModal.style.display = 'block';
}

// 구매 확인
async function confirmPurchase() {
    const purchaseModal = document.getElementById('purchaseModal');
    const productId = purchaseModal.getAttribute('data-product-id');
    
    if (!productId) {
        showNotification('상품 정보를 찾을 수 없습니다.', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ product_id: parseInt(productId) }),
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('거래가 완료되었습니다!', 'success');
            closeModal('purchaseModal');
            // 메인화면으로 이동
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } else {
            showNotification(result.error, 'error');
        }
    } catch (error) {
        console.error('구매 오류:', error);
        showNotification('구매 중 오류가 발생했습니다.', 'error');
    }
}


// 댓글 제출
async function submitComment(productId) {
    const commentText = document.getElementById('commentText');
    const comment = commentText.value.trim();
    
    if (!comment) {
        showNotification('댓글을 입력해주세요.', 'warning');
        return;
    }
    
    if (!window.currentUser) {
        showNotification('로그인이 필요합니다.', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId,
                comment: comment
            })
        });
        
        if (response.ok) {
            showNotification('댓글이 등록되었습니다.', 'success');
            commentText.value = '';
            loadComments(productId);
        } else {
            const error = await response.json();
            showNotification('댓글 등록 실패: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('댓글 등록 오류:', error);
        showNotification('댓글 등록 중 오류가 발생했습니다.', 'error');
    }
}

// 댓글 로드
async function loadComments(productId) {
    try {
        const response = await fetch(`/api/comments/${productId}`);
        if (response.ok) {
            const result = await response.json();
            displayComments(result.comments);
        } else {
            console.error('댓글 로드 실패');
        }
    } catch (error) {
        console.error('댓글 로드 오류:', error);
    }
}

// 댓글 표시
function displayComments(comments) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    if (!comments || comments.length === 0) {
        commentsList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">아직 문의가 없습니다.</p>';
        return;
    }
    
    commentsList.innerHTML = comments.map(comment => `
        <div class="comment-item">
            <div class="comment-header">
                <span class="comment-user">${comment.user_nickname}</span>
                <span class="comment-date">${new Date(comment.created_at).toLocaleDateString('ko-KR')}</span>
            </div>
            <div class="comment-content">${comment.comment}</div>
        </div>
    `).join('');
}

// 채팅 시작
async function startChat(productId) {
    if (!window.currentUser) {
        showNotification('로그인이 필요합니다.', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/chat/room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ product_id: productId }),
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            // 채팅 페이지로 이동
            window.location.href = `/chat/${result.room_id}`;
        } else {
            const error = await response.json();
            console.error('채팅방 생성 오류:', error);
            showNotification(error.error || '채팅방을 생성하는 중 오류가 발생했습니다.', 'error');
        }
    } catch (error) {
        console.error('채팅 시작 오류:', error);
        showNotification('채팅을 시작하는 중 오류가 발생했습니다.', 'error');
    }
}

// 관리자 상품 삭제 기능은 관리자 상품 관리 페이지에서만 사용 가능

