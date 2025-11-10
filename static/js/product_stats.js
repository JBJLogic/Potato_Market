// product_stats.js
let categoryChart = null;
let deliveryChart = null;

document.addEventListener('DOMContentLoaded', function() {
    loadProductStats();
});

// 상품 통계 로드
async function loadProductStats() {
    try {
        const response = await fetch('/api/admin/product-stats', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                showNotification('관리자 권한이 필요합니다.', 'error');
                window.location.href = '/'; // 메인 페이지로 리다이렉트
                return;
            }
            throw new Error('상품 통계 로드 실패');
        }
        
        const stats = await response.json();
        
        // 통계 카드 업데이트
        updateStatsCards(stats);
        
        // 차트 생성
        createCategoryChart(stats.category_stats);
        createDeliveryChart(stats.delivery_stats);
        
        // 가격 통계 테이블 업데이트
        updatePriceStatsTable(stats.price_stats);
        
    } catch (error) {
        console.error('상품 통계 로드 오류:', error);
        showNotification('상품 통계를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 통계 카드 업데이트
function updateStatsCards(stats) {
    document.getElementById('totalProducts').textContent = stats.total_products.toLocaleString();
    document.getElementById('totalCategories').textContent = stats.total_categories;
    document.getElementById('totalDeliveryMethods').textContent = stats.total_delivery_methods;
}

// 카테고리별 막대그래프 생성
function createCategoryChart(categoryStats) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    // 기존 차트가 있으면 제거
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    const labels = categoryStats.map(item => item.category);
    const data = categoryStats.map(item => item.count);
    
    // 색상 배열
    const colors = [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(255, 205, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)'
    ];
    
    categoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '상품 수',
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: colors.slice(0, labels.length).map(color => color.replace('0.8', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y}개`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 배송방법별 원형그래프 생성
function createDeliveryChart(deliveryStats) {
    const ctx = document.getElementById('deliveryChart').getContext('2d');
    
    // 기존 차트가 있으면 제거
    if (deliveryChart) {
        deliveryChart.destroy();
    }
    
    const labels = deliveryStats.map(item => item.delivery_method);
    const data = deliveryStats.map(item => item.count);
    
    // 색상 배열
    const colors = [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(255, 205, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)'
    ];
    
    deliveryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: colors.slice(0, labels.length).map(color => color.replace('0.8', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed}개 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 가격 통계 테이블 업데이트
function updatePriceStatsTable(priceStats) {
    const tbody = document.getElementById('priceStatsTableBody');
    tbody.innerHTML = '';
    
    if (priceStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">상품 데이터가 없습니다.</td></tr>';
        return;
    }
    
    priceStats.forEach(stat => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td class="category-name">${escapeHtml(stat.category)}</td>
            <td class="product-count">${stat.count}개</td>
            <td class="max-price">${stat.max_price.toLocaleString()}원</td>
            <td class="min-price">${stat.min_price.toLocaleString()}원</td>
            <td class="avg-price">${stat.avg_price.toLocaleString()}원</td>
        `;
    });
}

// 뒤로가기 함수
function goBack() {
    window.history.back();
}

// 유틸리티 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


