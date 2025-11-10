// 게시판 JavaScript
let currentPage = 1;
const perPage = 10;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    loadBoardPosts();
    setupWriteForm();
    setupAnswerForm();
    // global.js에서 이미 세션을 확인하므로 중복 호출 제거
    // checkSessionStatus();
});

// 게시글 목록 로드
async function loadBoardPosts(page = 1) {
    try {
        const response = await fetch(`/api/board?page=${page}&per_page=${perPage}`);
        if (response.ok) {
            const result = await response.json();
            displayBoardPosts(result.posts);
            displayBoardPagination(result);
            currentPage = page;
        } else {
            console.error('게시글 로드 실패');
            displayBoardPosts([]);
        }
    } catch (error) {
        console.error('게시글 로드 오류:', error);
        displayBoardPosts([]);
    }
}

// 게시글 목록 표시
function displayBoardPosts(posts) {
    const boardList = document.getElementById('boardList');
    
    if (!posts || posts.length === 0) {
        boardList.innerHTML = `
            <div class="board-row empty-row">
                <div class="board-col-full">등록된 게시글이 없습니다.</div>
            </div>
        `;
        return;
    }
    
    boardList.innerHTML = posts.map(post => `
        <div class="board-row" onclick="viewPost(${post.QNA_ID})">
            <div class="board-col-no">${post.QNA_ID}</div>
            <div class="board-col-title">
                <span class="post-title">${escapeHtml(post.title)}</span>
                ${post.answer ? '<span class="answered-badge">답변완료</span>' : ''}
            </div>
            <div class="board-col-author">${escapeHtml(post.author)}</div>
            <div class="board-col-views">${post.view_count}</div>
            <div class="board-col-date">${formatDate(post.created_at)}</div>
        </div>
    `).join('');
}

// 게시글 상세 보기
async function viewPost(postId) {
    try {
        const response = await fetch(`/api/board/${postId}`);
        if (response.ok) {
            const result = await response.json();
            showPostDetail(result.post);
        } else {
            alert('게시글을 불러올 수 없습니다.');
        }
    } catch (error) {
        console.error('게시글 조회 오류:', error);
        alert('게시글을 불러오는 중 오류가 발생했습니다.');
    }
}

// 게시글 상세 모달 표시
function showPostDetail(post) {
    document.getElementById('detailTitle').textContent = post.title;
    document.getElementById('detailAuthor').textContent = post.author;
    document.getElementById('detailDate').textContent = formatDate(post.created_at);
    document.getElementById('detailViews').textContent = post.view_count;
    document.getElementById('detailContent').innerHTML = escapeHtml(post.question).replace(/\n/g, '<br>');
    
    // 답변 표시
    const answerSection = document.getElementById('answerSection');
    const answerWriteSection = document.getElementById('answerWriteSection');
    const writeAnswerBtn = document.getElementById('writeAnswerBtn');
    const adminDeleteBtn = document.getElementById('adminDeleteBtn');
    
    if (post.answer) {
        // 답변이 있는 경우
        document.getElementById('answerDisplay').innerHTML = escapeHtml(post.answer).replace(/\n/g, '<br>');
        answerSection.style.display = 'block';
        answerWriteSection.style.display = 'none';
        writeAnswerBtn.style.display = 'none';
    } else {
        // 답변이 없는 경우
        answerSection.style.display = 'none';
        answerWriteSection.style.display = 'none';
        // 관리자만 답변 작성 버튼 표시
        if (window.currentUser && window.currentUser.type === 'manager') {
            writeAnswerBtn.style.display = 'block';
        } else {
            writeAnswerBtn.style.display = 'none';
        }
    }
    
    // 관리자 삭제 버튼 표시 (관리자만)
    if (window.currentUser && window.currentUser.type === 'manager') {
        adminDeleteBtn.style.display = 'inline-block';
    } else {
        adminDeleteBtn.style.display = 'none';
    }
    
    // 현재 게시글 ID 저장
    window.currentPostId = post.QNA_ID;
    
    const detailModal = document.getElementById('detailModal');
    if (detailModal) {
        detailModal.style.display = 'block';
    }
}

// 게시글 작성 모달 표시
async function showWriteModal() {
    // 서버에서 세션 상태 재확인
    try {
        const response = await fetch('/api/check-session');
        if (response.ok) {
            const result = await response.json();
            if (!result.logged_in) {
                alert('로그인이 필요합니다.');
                showLoginModal();
                return;
            }
        } else {
            // 세션 확인 실패 시 로컬 확인
            if (!isLoggedIn()) {
                alert('로그인이 필요합니다.');
                showLoginModal();
                return;
            }
        }
    } catch (error) {
        console.error('세션 확인 오류:', error);
        // 오류 발생 시 로컬 확인
        if (!isLoggedIn()) {
            alert('로그인이 필요합니다.');
            showLoginModal();
            return;
        }
    }
    
    const writeModal = document.getElementById('writeModal');
    if (writeModal) {
        writeModal.style.display = 'block';
        document.getElementById('boardTitle').focus();
    }
}

// 게시글 작성 모달 닫기
function closeWriteModal() {
    const writeModal = document.getElementById('writeModal');
    if (writeModal) {
        // 작성 중인 내용이 있는지 확인
        const title = document.getElementById('boardTitle').value.trim();
        const content = document.getElementById('boardContent').value.trim();
        
        if (title || content) {
            // 작성 중인 내용이 있으면 확인 메시지 표시
            if (confirm('작성 중인 내용이 있습니다. 정말 닫으시겠습니까?')) {
                writeModal.style.display = 'none';
                document.getElementById('writeForm').reset();
            }
        } else {
            // 작성 중인 내용이 없으면 바로 닫기
            writeModal.style.display = 'none';
            document.getElementById('writeForm').reset();
        }
    }
}

// 게시글 상세 모달 닫기
function closeDetailModal() {
    const detailModal = document.getElementById('detailModal');
    if (detailModal) {
        // 답변 작성 중인지 확인
        const answerWriteSection = document.getElementById('answerWriteSection');
        const answerContent = document.getElementById('answerContent');
        
        if (answerWriteSection && answerWriteSection.style.display === 'block' && answerContent) {
            const answerText = answerContent.value.trim();
            if (answerText) {
                // 답변 작성 중이고 내용이 있으면 확인 메시지 표시
                if (confirm('작성 중인 답변이 있습니다. 정말 닫으시겠습니까?')) {
                    detailModal.style.display = 'none';
                    // 게시판 목록 새로고침
                    loadBoardPosts(currentPage);
                }
                return;
            }
        }
        
        // 답변 작성 중이 아니거나 내용이 없으면 바로 닫기
        detailModal.style.display = 'none';
        // 게시판 목록 새로고침
        loadBoardPosts(currentPage);
    }
}

// 답변 작성 폼 표시
async function showAnswerForm() {
    // 서버에서 세션 상태 재확인
    try {
        const response = await fetch('/api/check-session');
        if (response.ok) {
            const result = await response.json();
            if (!result.logged_in) {
                alert('로그인이 필요합니다.');
                showLoginModal();
                return;
            }
        } else {
            // 세션 확인 실패 시 로컬 확인
            if (!isLoggedIn()) {
                alert('로그인이 필요합니다.');
                showLoginModal();
                return;
            }
        }
    } catch (error) {
        console.error('세션 확인 오류:', error);
        // 오류 발생 시 로컬 확인
        if (!isLoggedIn()) {
            alert('로그인이 필요합니다.');
            showLoginModal();
            return;
        }
    }
    
    document.getElementById('answerWriteSection').style.display = 'block';
    document.getElementById('writeAnswerBtn').style.display = 'none';
    document.getElementById('answerContent').focus();
}

// 답변 작성 취소
function cancelAnswer() {
    // 작성 중인 답변 내용이 있는지 확인
    const answerContent = document.getElementById('answerContent').value.trim();
    
    if (answerContent) {
        // 작성 중인 내용이 있으면 확인 메시지 표시
        if (confirm('작성 중인 답변이 있습니다. 정말 취소하시겠습니까?')) {
            document.getElementById('answerWriteSection').style.display = 'none';
            document.getElementById('writeAnswerBtn').style.display = 'block';
            document.getElementById('answerForm').reset();
            // 게시판 목록 새로고침
            loadBoardPosts(currentPage);
        }
    } else {
        // 작성 중인 내용이 없으면 바로 취소
        document.getElementById('answerWriteSection').style.display = 'none';
        document.getElementById('writeAnswerBtn').style.display = 'block';
        document.getElementById('answerForm').reset();
        // 게시판 목록 새로고침
        loadBoardPosts(currentPage);
    }
}

// 게시글 작성 폼 설정
function setupWriteForm() {
    const writeForm = document.getElementById('writeForm');
    writeForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const title = document.getElementById('boardTitle').value.trim();
        const content = document.getElementById('boardContent').value.trim();
        
        if (!title || !content) {
            alert('제목과 내용을 모두 입력해주세요.');
            return;
        }
        
        try {
            const response = await fetch('/api/board', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    content: content
                })
            });
            
            if (response.ok) {
                alert('게시글이 성공적으로 작성되었습니다.');
                // 성공적으로 등록된 경우 확인 메시지 없이 바로 닫기
                const writeModal = document.getElementById('writeModal');
                if (writeModal) {
                    writeModal.style.display = 'none';
                    document.getElementById('writeForm').reset();
                }
                loadBoardPosts(currentPage);
            } else if (response.status === 401) {
                // 세션 만료 시 로그인 모달 표시
                alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
                showLoginModal();
                closeWriteModal();
            } else {
                const result = await response.json();
                alert(result.error || '게시글 작성에 실패했습니다.');
            }
        } catch (error) {
            console.error('게시글 작성 오류:', error);
            alert('게시글 작성 중 오류가 발생했습니다.');
        }
    });
}

// 답변 작성 폼 설정
function setupAnswerForm() {
    const answerForm = document.getElementById('answerForm');
    answerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const answerContent = document.getElementById('answerContent').value.trim();
        
        if (!answerContent) {
            alert('답변 내용을 입력해주세요.');
            return;
        }
        
        try {
            const response = await fetch(`/api/board/${window.currentPostId}/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    answer: answerContent
                })
            });
            
            if (response.ok) {
                alert('답변이 성공적으로 등록되었습니다.');
                // 답변 작성 섹션 숨기기 (확인 메시지 없이)
                document.getElementById('answerWriteSection').style.display = 'none';
                document.getElementById('writeAnswerBtn').style.display = 'block';
                document.getElementById('answerForm').reset();
                // 게시글 다시 로드
                viewPost(window.currentPostId);
                // 게시판 목록도 새로고침 (답변 완료 상태 반영)
                loadBoardPosts(currentPage);
            } else if (response.status === 401) {
                // 세션 만료 시 로그인 모달 표시
                alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
                showLoginModal();
                cancelAnswer();
            } else {
                const result = await response.json();
                alert(result.error || '답변 등록에 실패했습니다.');
            }
        } catch (error) {
            console.error('답변 등록 오류:', error);
            alert('답변 등록 중 오류가 발생했습니다.');
        }
    });
}

// 페이징 표시
function displayBoardPagination(result) {
    const pagination = document.getElementById('boardPagination');
    const totalPages = result.total_pages;
    const currentPageNum = result.page;
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // 이전 페이지 버튼
    if (currentPageNum > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="loadBoardPosts(${currentPageNum - 1})">이전</button>`;
    }
    
    // 페이지 번호들
    const startPage = Math.max(1, currentPageNum - 2);
    const endPage = Math.min(totalPages, currentPageNum + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPageNum ? 'active' : '';
        paginationHTML += `<button class="pagination-btn ${activeClass}" onclick="loadBoardPosts(${i})">${i}</button>`;
    }
    
    // 다음 페이지 버튼
    if (currentPageNum < totalPages) {
        paginationHTML += `<button class="pagination-btn" onclick="loadBoardPosts(${currentPageNum + 1})">다음</button>`;
    }
    
    pagination.innerHTML = paginationHTML;
}

// 유틸리티 함수들
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    
    // 날짜와 시간을 모두 표시
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function isLoggedIn() {
    // global.js의 window.currentUser를 우선 확인
    if (window.currentUser) {
        return true;
    }
    
    // 백업으로 localStorage 확인
    const userInfo = localStorage.getItem('user');
    return userInfo !== null;
}

// 모달 외부 클릭 시 닫기 (모든 모달에서 외부 클릭으로 닫히지 않음)
window.onclick = function(event) {
    const writeModal = document.getElementById('writeModal');
    const detailModal = document.getElementById('detailModal');
    
    // 모든 모달은 외부 클릭으로 닫히지 않음 (실수로 닫히는 것을 방지)
    // 글쓰기 모달과 게시글 상세 모달 모두 보호
}

// 관리자 게시글 삭제 확인 모달 표시
function showAdminDeleteConfirm() {
    const modal = document.getElementById('adminDeleteModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// 관리자 게시글 삭제 확인
async function confirmAdminDelete() {
    const postId = window.currentPostId;
    if (!postId) return;
    
    try {
        const response = await fetch(`/api/board/${postId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(result.message, 'success');
            closeAdminDeleteModal();
            closeDetailModal();
            loadBoardPosts(currentPage); // 게시글 목록 새로고침
        } else {
            const error = await response.json();
            showNotification(error.error, 'error');
        }
    } catch (error) {
        console.error('게시글 삭제 오류:', error);
        showNotification('게시글 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 관리자 삭제 모달 닫기
function closeAdminDeleteModal() {
    const modal = document.getElementById('adminDeleteModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ESC 키로 모달 닫기 (모든 모달에서 ESC로 닫히지 않음)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const writeModal = document.getElementById('writeModal');
        const detailModal = document.getElementById('detailModal');
        
        // 모든 모달은 ESC로 닫히지 않음 (실수로 닫히는 것을 방지)
        // 글쓰기 모달과 게시글 상세 모달 모두 보호
    }
});

