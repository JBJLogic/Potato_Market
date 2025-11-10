// chatbot.js
document.addEventListener('DOMContentLoaded', function() {
    // 환영 메시지 시간 설정
    const welcomeTime = document.getElementById('welcomeTime');
    if (welcomeTime) {
        welcomeTime.textContent = getCurrentTime();
    }
    
    // 입력창 포커스
    const chatbotInput = document.getElementById('chatbotInput');
    if (chatbotInput) {
        chatbotInput.focus();
    }
});

// 현재 시간 반환
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// 엔터키 처리
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 텍스트 영역 자동 크기 조정
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// 메시지 전송
async function sendMessage() {
    const input = document.getElementById('chatbotInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // 입력창 비우기
    input.value = '';
    input.style.height = 'auto';
    
    // 사용자 메시지 추가
    addMessage(message, 'user');
    
    // 전송 버튼 비활성화
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    
    // 타이핑 인디케이터 표시
    showTypingIndicator();
    
    try {
        const response = await fetch('/api/chatbot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('챗봇 응답을 받을 수 없습니다.');
        }
        
        const data = await response.json();
        
        // 타이핑 인디케이터 숨기기
        hideTypingIndicator();
        
        // 챗봇 응답 추가
        addMessage(data.response, 'bot');
        
    } catch (error) {
        console.error('챗봇 오류:', error);
        hideTypingIndicator();
        addMessage('죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'bot');
    } finally {
        // 전송 버튼 활성화
        sendBtn.disabled = false;
        input.focus();
    }
}

// 메시지 추가
function addMessage(text, sender) {
    const messagesContainer = document.getElementById('chatbotMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${escapeHtml(text)}</div>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${escapeHtml(text)}</div>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 타이핑 인디케이터 표시
function showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'block';
        scrollToBottom();
    }
}

// 타이핑 인디케이터 숨기기
function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// 채팅창 맨 아래로 스크롤
function scrollToBottom() {
    const messagesContainer = document.getElementById('chatbotMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// 대화 초기화
function clearChat() {
    if (confirm('대화 기록을 모두 삭제하시겠습니까?')) {
        const messagesContainer = document.getElementById('chatbotMessages');
        if (messagesContainer) {
            // 환영 메시지만 남기고 모든 메시지 삭제
            const welcomeMessage = messagesContainer.querySelector('.bot-message');
            messagesContainer.innerHTML = '';
            if (welcomeMessage) {
                messagesContainer.appendChild(welcomeMessage);
            }
        }
        
        // 서버에서도 세션 초기화
        fetch('/api/chatbot/clear', {
            method: 'POST',
            credentials: 'include'
        }).catch(error => {
            console.error('세션 초기화 오류:', error);
        });
    }
}

// HTML 이스케이프 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


