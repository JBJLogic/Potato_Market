// 사용자 관리 페이지 JavaScript

// 전역 변수
let currentPage = 1;
let currentSearch = '';
let currentFilter = 'all';
let totalPages = 1;

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeUserManagement();
});

// 사용자 관리 페이지 초기화
function initializeUserManagement() {
    loadUsers();
    setupEventListeners();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 사용자 수정 폼 이벤트
    const userEditForm = document.getElementById('userEditForm');
    if (userEditForm) {
        userEditForm.addEventListener('submit', handleUserEdit);
    }
}

// 사용자 목록 로드
async function loadUsers(page = 1, search = '', filter = 'all') {
    try {
        currentPage = page;
        currentSearch = search;
        currentFilter = filter;
        
        const params = new URLSearchParams({
            page: page,
            per_page: 20
        });
        
        if (search) {
            params.append('search', search);
        }
        
        if (filter !== 'all') {
            params.append('filter', filter);
        }
        
        const response = await fetch(`/api/admin/users?${params}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            displayUsers(result.users);
            updatePagination(result);
            updateUserStats(result.users);
        } else {
            const error = await response.json();
            console.error('사용자 목록 로드 실패:', error.error);
            showNotification('사용자 목록을 불러올 수 없습니다.', 'error');
        }
    } catch (error) {
        console.error('사용자 목록 로드 오류:', error);
        showNotification('사용자 목록을 불러올 수 없습니다.', 'error');
    }
}

// 사용자 목록 표시
function displayUsers(users) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div class="empty-message">
                        <i class="fas fa-users"></i>
                        <p>사용자가 없습니다.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = users.map(user => `
        <tr class="user-row ${!user.is_active ? 'inactive' : ''}">
            <td class="user-id">${user.USER_ID}</td>
            <td class="user-email">${user.email}</td>
            <td class="user-nickname">${user.nickname}</td>
            <td class="user-money">${user.money.toLocaleString()}원</td>
            <td class="user-date">${new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
            <td class="user-status">
                <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? '활성' : '비활성'}
                </span>
            </td>
            <td class="user-actions">
                <button class="btn btn-sm btn-primary" onclick="editUser(${user.USER_ID})" ${!user.is_active ? 'disabled' : ''}>
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.USER_ID}, '${user.nickname}')" ${!user.is_active ? 'disabled' : ''}>
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </td>
        </tr>
    `).join('');
}

// 페이징 업데이트
function updatePagination(result) {
    const pagination = document.getElementById('usersPagination');
    if (!pagination) return;
    
    totalPages = result.total_pages;
    
    // 페이지가 1개 이하이면 페이징 버튼 숨김
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // 이전 버튼 - 첫 번째 페이지가 아니면 활성화
    if (result.page > 1) {
        paginationHTML += `
            <button class="pagination-btn prev-btn" onclick="loadUsers(${result.page - 1}, '${currentSearch}', '${currentFilter}')">
                <i class="fas fa-chevron-left"></i> 이전
            </button>
        `;
    } else {
        paginationHTML += `
            <button class="pagination-btn prev-btn disabled" disabled>
                <i class="fas fa-chevron-left"></i> 이전
            </button>
        `;
    }
    
    // 현재 페이지 정보
    paginationHTML += `<span class="page-info">${result.page} / ${totalPages}</span>`;
    
    // 다음 버튼 - 마지막 페이지가 아니면 활성화
    if (result.page < totalPages) {
        paginationHTML += `
            <button class="pagination-btn next-btn" onclick="loadUsers(${result.page + 1}, '${currentSearch}', '${currentFilter}')">
                다음 <i class="fas fa-chevron-right"></i>
            </button>
        `;
    } else {
        paginationHTML += `
            <button class="pagination-btn next-btn disabled" disabled>
                다음 <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    pagination.innerHTML = paginationHTML;
}

// 사용자 통계 업데이트
function updateUserStats(users) {
    const totalUsers = users.length;
    const activeUsers = users.filter(user => user.is_active).length;
    const inactiveUsers = totalUsers - activeUsers;
    
    const totalUsersElement = document.getElementById('totalUsers');
    const activeUsersElement = document.getElementById('activeUsers');
    const inactiveUsersElement = document.getElementById('inactiveUsers');
    
    if (totalUsersElement) totalUsersElement.textContent = `총 ${totalUsers}명`;
    if (activeUsersElement) activeUsersElement.textContent = `활성 ${activeUsers}명`;
    if (inactiveUsersElement) inactiveUsersElement.textContent = `비활성 ${inactiveUsers}명`;
}

// 사용자 검색
function searchUsers() {
    const searchInput = document.getElementById('userSearchInput');
    const searchTerm = searchInput.value.trim();
    
    // 디바운싱을 위한 타이머 설정
    clearTimeout(window.searchTimer);
    window.searchTimer = setTimeout(() => {
        loadUsers(1, searchTerm, currentFilter);
    }, 300);
}

// 사용자 필터링
function filterUsers() {
    const filterSelect = document.getElementById('statusFilter');
    const filterValue = filterSelect.value;
    
    loadUsers(1, currentSearch, filterValue);
}

// 사용자 수정 모달 표시
function editUser(userId) {
    // 사용자 정보 로드
    loadUserForEdit(userId);
    
    const modal = document.getElementById('userEditModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// 수정할 사용자 정보 로드
async function loadUserForEdit(userId) {
    try {
        // 사용자 목록에서 해당 사용자 정보 찾기
        const userRows = document.querySelectorAll('.user-row');
        let userData = null;
        
        userRows.forEach(row => {
            const editBtn = row.querySelector(`button[onclick*="${userId}"]`);
            if (editBtn) {
                const cells = row.querySelectorAll('td');
                const email = cells[1].textContent;
                const nickname = cells[2].textContent;
                const moneyText = cells[3].textContent;
                const money = parseInt(moneyText.replace(/[^0-9]/g, ''));
                
                userData = {
                    USER_ID: userId,
                    nickname: nickname,
                    email: email,
                    money: money
                };
            }
        });
        
        if (userData) {
            document.getElementById('editUserId').value = userData.USER_ID;
            document.getElementById('editUserEmail').value = userData.email;
            document.getElementById('editUserNickname').value = userData.nickname;
            document.getElementById('editUserMoney').value = userData.money;
        }
    } catch (error) {
        console.error('사용자 정보 로드 오류:', error);
        showNotification('사용자 정보를 불러올 수 없습니다.', 'error');
    }
}

// 사용자 수정 처리
async function handleUserEdit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const userId = formData.get('user_id');
    const data = {
        email: formData.get('email'),
        nickname: formData.get('nickname'),
        money: parseInt(formData.get('money'))
    };
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (response.ok) {
            showNotification('사용자 정보가 성공적으로 수정되었습니다.', 'success');
            closeUserEditModal();
            loadUsers(currentPage, currentSearch, currentFilter); // 사용자 목록 새로고침
        } else {
            const error = await response.json();
            showNotification(error.error, 'error');
        }
    } catch (error) {
        console.error('사용자 수정 오류:', error);
        showNotification('사용자 정보 수정 중 오류가 발생했습니다.', 'error');
    }
}

// 사용자 삭제 모달 표시
function deleteUser(userId, nickname) {
    window.currentDeleteUserId = userId;
    document.getElementById('deleteConfirmMessage').textContent = `정말로 "${nickname}" 사용자를 삭제하시겠습니까?`;
    
    const modal = document.getElementById('userDeleteModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// 사용자 삭제 확인
async function confirmUserDelete() {
    const userId = window.currentDeleteUserId;
    if (!userId) return;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(result.message, 'success');
            closeUserDeleteModal();
            loadUsers(currentPage, currentSearch, currentFilter); // 사용자 목록 새로고침
        } else {
            const error = await response.json();
            showNotification(error.error, 'error');
        }
    } catch (error) {
        console.error('사용자 삭제 오류:', error);
        showNotification('사용자 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// 모달 닫기 함수들
function closeUserEditModal() {
    const modal = document.getElementById('userEditModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('userEditForm').reset();
    }
}

function closeUserDeleteModal() {
    const modal = document.getElementById('userDeleteModal');
    if (modal) {
        modal.style.display = 'none';
        window.currentDeleteUserId = null;
    }
}

// 뒤로가기
function goBack() {
    window.location.href = '/admin';
}

// 모달 외부 클릭 시 닫기
window.onclick = function(event) {
    const modals = ['userEditModal', 'userDeleteModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}
