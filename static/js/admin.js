// 관리자 대시보드 JavaScript

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminDashboard();
});

// 관리자 대시보드 초기화
function initializeAdminDashboard() {
    loadAdminStats();
    loadRecentActivity();
    setupEventListeners();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 추후 다른 이벤트 리스너들을 여기에 추가
}

// 관리자 통계 로드
async function loadAdminStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const stats = await response.json();
            updateStatsDisplay(stats);
        } else {
            console.error('통계 로드 실패');
        }
    } catch (error) {
        console.error('통계 로드 오류:', error);
    }
}

// 통계 표시 업데이트
function updateStatsDisplay(stats) {
    const elements = {
        totalUsers: document.getElementById('totalUsers'),
        totalProducts: document.getElementById('totalProducts'),
        totalTransactions: document.getElementById('totalTransactions'),
        totalPosts: document.getElementById('totalPosts')
    };
    
    if (elements.totalUsers) elements.totalUsers.textContent = stats.total_users || 0;
    if (elements.totalProducts) elements.totalProducts.textContent = stats.total_products || 0;
    if (elements.totalTransactions) elements.totalTransactions.textContent = stats.total_transactions || 0;
    if (elements.totalPosts) elements.totalPosts.textContent = stats.total_posts || 0;
}

// 최근 활동 로드
async function loadRecentActivity() {
    try {
        const response = await fetch('/api/admin/activity', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const activities = await response.json();
            displayRecentActivity(activities);
        } else {
            console.error('활동 로드 실패');
        }
    } catch (error) {
        console.error('활동 로드 오류:', error);
    }
}

// 최근 활동 표시
function displayRecentActivity(activities) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    if (!activities || activities.length === 0) {
        activityList.innerHTML = '<p style="text-align: center; color: #666;">최근 활동이 없습니다.</p>';
        return;
    }
    
    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas ${getActivityIcon(activity.type)}"></i>
            </div>
            <div class="activity-content">
                <h4>${activity.title}</h4>
                <p>${activity.description}</p>
                <span class="activity-date">${new Date(activity.created_at).toLocaleString('ko-KR')}</span>
            </div>
        </div>
    `).join('');
}

// 활동 타입별 아이콘 반환
function getActivityIcon(type) {
    switch(type) {
        case 'product': return 'fa-box';
        case 'post': return 'fa-comments';
        default: return 'fa-info-circle';
    }
}

// 사용자 관리 페이지로 이동
function viewUsers() {
    window.location.href = '/admin/users';
}


// 기타 관리 기능들 (추후 구현)

function viewProducts() {
    window.location.href = '/admin/products';
}

function viewProductStats() {
    window.location.href = '/admin/product-stats';
}

function viewBoard() {
    window.location.href = '/board';
}

