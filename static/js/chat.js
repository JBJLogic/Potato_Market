// 채팅 페이지 JavaScript

let socket = null;
let currentRoomId = null;
let currentUserId = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
});

// 채팅 초기화
async function initializeChat() {
    // URL에서 room_id 추출
    const path = window.location.pathname;
    const match = path.match(/\/chat\/(\d+)/);
    if (!match) {
        showNotification('채팅방 ID를 찾을 수 없습니다.', 'error');
        setTimeout(() => window.location.href = '/mypage', 2000);
        return;
    }
    
    currentRoomId = parseInt(match[1]);
    
    // 사용자 정보 확인
    await checkSessionStatus();
    
    if (!window.currentUser) {
        showNotification('로그인이 필요합니다.', 'warning');
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }
    
    // user_id 또는 id 필드 확인 (API 응답에 따라 다를 수 있음)
    currentUserId = window.currentUser.user_id || window.currentUser.id;
    
    if (!currentUserId) {
        console.error('사용자 ID를 찾을 수 없습니다:', window.currentUser);
        showNotification('사용자 정보를 불러올 수 없습니다.', 'error');
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }
    
    // 채팅방 정보 및 메시지 로드
    await loadChatRoom();
    
    // Socket.IO 연결
    connectSocket();
    
    // 입력창 이벤트 설정
    setupInputEvents();
}

// 세션 상태 확인
async function checkSessionStatus() {
    try {
        const response = await fetch('/api/check-session', {
            credentials: 'include'  // 세션 쿠키 전달
        });
        if (response.ok) {
            const result = await response.json();
            if (result.logged_in) {
                window.currentUser = result.user;
                localStorage.setItem('user', JSON.stringify(result.user));
                // 헤더 업데이트
                updateHeaderInterface(result.user);
            } else {
                const userInfo = localStorage.getItem('user');
                if (userInfo) {
                    window.currentUser = JSON.parse(userInfo);
                    // 헤더 업데이트
                    updateHeaderInterface(window.currentUser);
                } else {
                    // 로그인되지 않은 경우 헤더 초기화
                    updateHeaderInterface(null);
                }
            }
        }
    } catch (error) {
        console.error('세션 확인 오류:', error);
        const userInfo = localStorage.getItem('user');
        if (userInfo) {
            window.currentUser = JSON.parse(userInfo);
            updateHeaderInterface(window.currentUser);
        } else {
            updateHeaderInterface(null);
        }
    }
}

// 헤더 인터페이스 업데이트
function updateHeaderInterface(user) {
    // global.js의 updateUserInterface 함수 사용 (이미 로드되어 있음)
    if (typeof updateUserInterface === 'function') {
        updateUserInterface(user);
    } else {
        // fallback: 직접 업데이트
        const authButtons = document.getElementById('authButtons');
        const userButtons = document.getElementById('userButtons');
        const adminButtons = document.getElementById('adminButtons');
        
        if (user) {
            window.currentUser = user;
            // 모든 버튼 그룹 숨기기
            if (authButtons) authButtons.style.display = 'none';
            if (userButtons) userButtons.style.display = 'none';
            if (adminButtons) adminButtons.style.display = 'none';
            
            // 사용자 타입에 따라 적절한 버튼 그룹 표시
            if (user.type === 'manager') {
                if (adminButtons) {
                    adminButtons.style.display = 'flex';
                    adminButtons.style.gap = '0.5rem';
                }
            } else {
                if (userButtons) {
                    userButtons.style.display = 'flex';
                    userButtons.style.gap = '0.5rem';
                }
            }
        } else {
            window.currentUser = null;
            // 로그인 버튼만 표시
            if (authButtons) authButtons.style.display = 'flex';
            if (userButtons) userButtons.style.display = 'none';
            if (adminButtons) adminButtons.style.display = 'none';
        }
    }
}

// 채팅방 정보 및 메시지 로드
async function loadChatRoom() {
    try {
        const response = await fetch(`/api/chat/room/${currentRoomId}/messages`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            showNotification(error.error || '채팅방을 불러올 수 없습니다.', 'error');
            setTimeout(() => window.location.href = '/mypage', 2000);
            return;
        }
        
        const result = await response.json();
        const { room, messages } = result;
        
        // 헤더 정보 표시
        displayChatHeader(room);
        
        // 메시지 표시
        displayMessages(messages);
        
    } catch (error) {
        console.error('채팅방 로드 오류:', error);
        showNotification('채팅방을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 채팅 헤더 표시
function displayChatHeader(room) {
    const headerInfo = document.getElementById('chatHeaderInfo');
    
    if (headerInfo) {
        headerInfo.innerHTML = `
            <div class="chat-header-content">
                <div class="product-details-horizontal">
                    <span class="product-name">${room.product.product_name}</span>
                    <span class="product-separator">|</span>
                    <span class="product-price">${room.product.price.toLocaleString()}원</span>
                </div>
                <div class="user-separator">|</div>
                <div class="user-name">${room.other_user.nickname}</div>
            </div>
        `;
    }
}

// 메시지 표시
function displayMessages(messages) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    if (!messages || messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-messages">
                <p>아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>
            </div>
        `;
        return;
    }
    
    messagesContainer.innerHTML = messages.map(msg => {
        const isMyMessage = msg.SENDER_ID === currentUserId;
        // DB에서 받은 시간 문자열을 파싱 (YYYY-MM-DD HH:MM:SS 형식)
        let timeStr = '';
        try {
            let messageDate;
            if (typeof msg.created_at === 'string') {
                // MySQL datetime 형식: 'YYYY-MM-DD HH:MM:SS'
                // ISO 형식으로 변환: 'YYYY-MM-DDTHH:MM:SS'
                const dateStr = msg.created_at.replace(' ', 'T');
                messageDate = new Date(dateStr);
            } else if (msg.created_at) {
                messageDate = new Date(msg.created_at);
            } else {
                messageDate = new Date();
            }
            
            // Invalid Date 체크
            if (isNaN(messageDate.getTime())) {
                console.error('Invalid date:', msg.created_at);
                messageDate = new Date(); // 현재 시간으로 대체
            }
            
            timeStr = messageDate.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit'
            });
        } catch (error) {
            console.error('시간 파싱 오류:', error, msg.created_at);
            timeStr = new Date().toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit'
            });
        }
        
        return `
            <div class="message ${isMyMessage ? 'message-sent' : 'message-received'}">
                <div class="message-content">
                    <div class="message-text">${escapeHtml(msg.message)}</div>
                    <div class="message-time">${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');
    
    scrollToBottom();
}

// Socket.IO 연결
function connectSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Socket.IO 연결됨');
        // 채팅방 입장
        socket.emit('join_room', { room_id: currentRoomId });
    });
    
    socket.on('disconnect', () => {
        console.log('Socket.IO 연결 해제됨');
    });
    
    socket.on('receive_message', (messageData) => {
        // 새 메시지 수신
        addMessageToChat(messageData);
    });
    
    socket.on('error', (error) => {
        console.error('Socket.IO 오류:', error);
        showNotification(error.message || '오류가 발생했습니다.', 'error');
    });
}

// 메시지를 채팅에 추가
function addMessageToChat(messageData) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    // 빈 메시지 메시지 제거
    const emptyMsg = messagesContainer.querySelector('.empty-messages');
    if (emptyMsg) {
        emptyMsg.remove();
    }
    
    const isMyMessage = messageData.SENDER_ID === currentUserId;
    // DB에서 받은 시간 문자열을 파싱 (YYYY-MM-DD HH:MM:SS 형식)
    let timeStr = '';
    try {
        let messageDate;
        if (typeof messageData.created_at === 'string') {
            // MySQL datetime 형식: 'YYYY-MM-DD HH:MM:SS'
            // ISO 형식으로 변환: 'YYYY-MM-DDTHH:MM:SS'
            const dateStr = messageData.created_at.replace(' ', 'T');
            messageDate = new Date(dateStr);
        } else if (messageData.created_at) {
            messageDate = new Date(messageData.created_at);
        } else {
            messageDate = new Date();
        }
        
        // Invalid Date 체크
        if (isNaN(messageDate.getTime())) {
            console.error('Invalid date:', messageData.created_at);
            messageDate = new Date(); // 현재 시간으로 대체
        }
        
        timeStr = messageDate.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    } catch (error) {
        console.error('시간 파싱 오류:', error, messageData.created_at);
        timeStr = new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMyMessage ? 'message-sent' : 'message-received'}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text">${escapeHtml(messageData.message)}</div>
            <div class="message-time">${timeStr}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 메시지 전송
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (!socket || !socket.connected) {
        showNotification('서버에 연결되지 않았습니다.', 'error');
        return;
    }
    
    // 입력창 비우기
    input.value = '';
    input.style.height = 'auto';
    
    // 전송 버튼 비활성화
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.disabled = true;
    }
    
    try {
        // Socket.IO로 메시지 전송
        socket.emit('send_message', {
            room_id: currentRoomId,
            message: message,
            sender_id: currentUserId
        });
        
        // 전송 버튼 활성화
        if (sendBtn) {
            sendBtn.disabled = false;
        }
        
    } catch (error) {
        console.error('메시지 전송 오류:', error);
        showNotification('메시지 전송 중 오류가 발생했습니다.', 'error');
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
}

// 입력창 이벤트 설정
function setupInputEvents() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    
    // Enter 키로 전송 (Shift+Enter는 줄바꿈)
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    // 입력창 자동 높이 조절
    input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

// 스크롤을 맨 아래로
function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// HTML 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 뒤로가기
function goBack() {
    window.location.href = '/mypage';
}

// 알림 표시 함수
function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#000';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
}

