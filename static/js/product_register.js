// 상품 등록 페이지 JavaScript

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    setupImagePreview();
    setupFormSubmission();
    setupAddressHandlers();
    waitForKakaoMaps(initializeMap);
});

function waitForKakaoMaps(callback, retries = 20) {
    const kakaoReady = typeof kakao !== 'undefined' && kakao.maps;

    if (kakaoReady) {
        if (typeof kakao.maps.load === 'function') {
            kakao.maps.load(callback);
        } else {
            callback();
        }
        return;
    }

    if (retries <= 0) {
        console.error('Kakao Maps SDK 로드 실패');
        if (typeof showNotification === 'function') {
            showNotification('카카오 지도 로드에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
        }
        return;
    }

    setTimeout(() => waitForKakaoMaps(callback, retries - 1), 200);
}

let mapInstance = null;
let mapMarker = null;
let mapGeocoder = null;

// 이미지 미리보기 기능 설정
function setupImagePreview() {
    const imageInput = document.getElementById('productImage');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    if (imageInput && imagePreview && previewImg) {
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.style.display = 'none';
            }
        });
    }
}

// 폼 제출 이벤트 설정
function setupFormSubmission() {
    const form = document.getElementById('productForm');
    if (form) {
        form.addEventListener('submit', handleProductSubmit);
    }
}

// 상품 등록 처리
async function handleProductSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = document.getElementById('productBtn');
    const btnText = document.getElementById('productBtnText');
    const btnLoading = document.getElementById('productBtnLoading');
    const errorDiv = document.getElementById('productError');
    
    // 버튼 상태 변경
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    
    // 에러 메시지 숨기기
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
    
    const meetingZip = formData.get('meeting_zip_code');
    const meetingAddress = formData.get('meeting_address');
    
    if (!meetingZip || !meetingAddress) {
        showNotification('거래 주소를 입력해주세요.', 'warning');
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // 성공 메시지 표시
            showNotification('상품이 성공적으로 등록되었습니다!', 'success');
            
            // 폼 초기화
            form.reset();
            const imagePreview = document.getElementById('imagePreview');
            if (imagePreview) {
                imagePreview.style.display = 'none';
            }
            
            // 상품 목록 페이지로 이동
            setTimeout(() => {
                window.location.href = '/products';
            }, 1500);
            
        } else {
            // 에러 메시지 표시
            const errorMessage = result.error || '상품 등록 중 오류가 발생했습니다.';
            showNotification(errorMessage, 'error');
            
            if (errorDiv) {
                errorDiv.textContent = errorMessage;
                errorDiv.style.display = 'block';
            }
        }
        
    } catch (error) {
        console.error('상품 등록 오류:', error);
        const errorMessage = '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
        showNotification(errorMessage, 'error');
        
        if (errorDiv) {
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        }
    } finally {
        // 버튼 상태 복원
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// 뒤로가기 함수
function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = '/products';
    }
}

// 카카오 지도 초기화
function initializeMap() {
    const mapContainer = document.getElementById('registerMap');
    if (!mapContainer) {
        return;
    }

    if (typeof kakao === 'undefined' || !kakao.maps || !kakao.maps.services || !kakao.maps.LatLng) {
        console.error('카카오 지도 객체가 준비되지 않았습니다.');
        return;
    }
    
    const defaultPosition = new kakao.maps.LatLng(37.5665, 126.9780); // 서울 시청
    mapInstance = new kakao.maps.Map(mapContainer, {
        center: defaultPosition,
        level: 3
    });
    
    mapMarker = new kakao.maps.Marker({
        position: defaultPosition
    });
    mapMarker.setMap(mapInstance);
    
    mapGeocoder = new kakao.maps.services.Geocoder();
}

// 주소 입력 이벤트
function setupAddressHandlers() {
    const detailInput = document.getElementById('meetingDetail');
    if (detailInput) {
        detailInput.addEventListener('blur', function() {
            const address = document.getElementById('meetingAddress')?.value || '';
            updateMapByAddress(address, detailInput.value);
        });
    }
}

// 주소 검색 버튼
window.openAddressSearch = function() {
    if (typeof daum === 'undefined' || !daum.Postcode) return;
    
    new daum.Postcode({
        oncomplete: function(data) {
            let addr = '';
            
            if (data.userSelectedType === 'R') {
                addr = data.roadAddress;
            } else {
                addr = data.jibunAddress;
            }
            
            const postcodeInput = document.getElementById('meetingPostcode');
            const addressInput = document.getElementById('meetingAddress');
            const detailInput = document.getElementById('meetingDetail');
            
            if (postcodeInput) postcodeInput.value = data.zonecode;
            if (addressInput) addressInput.value = addr;
            if (detailInput) detailInput.focus();
            
            updateMapByAddress(addr, detailInput ? detailInput.value : '');
        }
    }).open();
};

// 주소로 지도 업데이트
function updateMapByAddress(address, detail) {
    if (!address || !mapGeocoder) return;
    
    const fullAddress = detail ? `${address} ${detail}` : address;
    mapGeocoder.addressSearch(fullAddress, function(result, status) {
        if (status === kakao.maps.services.Status.OK) {
            const lat = parseFloat(result[0].y);
            const lng = parseFloat(result[0].x);
            setMapPosition(lat, lng);
        } else {
            showNotification('주소로 위치를 찾을 수 없습니다. 상세주소를 확인해주세요.', 'warning');
        }
    });
}

// 지도와 숨김 필드 업데이트
function setMapPosition(lat, lng) {
    if (!mapInstance || !mapMarker) return;
    
    const coords = new kakao.maps.LatLng(lat, lng);
    mapInstance.setCenter(coords);
    mapMarker.setPosition(coords);
}