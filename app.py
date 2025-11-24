from flask import Flask, request, jsonify, render_template, session, abort
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import mysql.connector
from datetime import datetime
import hashlib
import os
import base64
import re
from dotenv import load_dotenv
from openai import OpenAI
from chatbot_rag import initialize_chatbot, get_chatbot

# AWS 관리 라이브러리. boto3 라이브러리를 사용해서 aws s3에 이미지 업로드 해야 함.
import boto3
import uuid

# 환경 변수 로드
load_dotenv()

app = Flask(__name__)
app.secret_key = 'potato_market_secret_key_2024'  # 세션을 위한 시크릿 키
CORS(app)  # CORS 설정으로 프론트엔드와의 통신 허용
socketio = SocketIO(app, cors_allowed_origins="*")  # SocketIO 초기화

# MySQL 데이터베이스 설정
DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME'),
    'charset': 'utf8mb4'
}

def get_db_connection():
    """데이터베이스 연결을 반환합니다."""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except mysql.connector.Error as err:
        print(f"데이터베이스 연결 오류: {err}")
        return None

def process_password(password):
    """비밀번호를 처리합니다."""
    return password

# 메인 페이지 라우트
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/product/<int:product_id>')
def product_detail(product_id):
    try:
        conn = get_db_connection()
        if not conn:
            abort(500)
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.PRODUCT_ID, p.product_name, p.price, p.description, p.image_url,
                   p.delivery_method, p.created_at, p.SELLER_ID, p.is_sold,
                   p.meeting_zip_code, p.meeting_address, p.meeting_detail, u.nickname
            FROM PRODUCT p
            JOIN USER u ON p.SELLER_ID = u.USER_ID
            WHERE p.PRODUCT_ID = %s
        """, (product_id,))
        
        product = cursor.fetchone()
        if not product:
            cursor.close()
            conn.close()
            abort(404)
        
        image_url = None
        if product[4]:
            image_base64 = base64.b64encode(product[4]).decode('utf-8')
            image_url = f"data:image/jpeg;base64,{image_base64}"
        
        created_at_display = product[6].strftime('%Y-%m-%d %H:%M') if product[6] else None
        created_at_iso = product[6].isoformat() if product[6] else None
        
        product_detail = {
            'id': product[0],
            'title': product[1] if product[1] else '상품명 없음',
            'price': product[2] if product[2] else 0,
            'description': product[3] if product[3] else '',
            'image_url': image_url,
            'delivery_method': product[5] if product[5] else '배송 정보 없음',
            'created_at': created_at_iso,
            'created_at_display': created_at_display,
            'seller_id': product[7],
            'seller_nickname': product[12] if product[12] else '알 수 없음',
            'is_sold': bool(product[8]),
            'meeting_zip_code': product[9],
            'meeting_address': product[10],
            'meeting_detail': product[11]
        }
        
        cursor.execute("""
            SELECT c.COMMENT_ID, c.comment, c.created_at, u.nickname
            FROM COMMENTS c
            JOIN USER u ON c.USER_ID = u.USER_ID
            WHERE c.PRODUCT_ID = %s
            ORDER BY c.created_at DESC
        """, (product_id,))
        comments = cursor.fetchall()
        cursor.close()
        conn.close()
        
        comment_list = []
        for comment in comments:
            created_at_display = comment[2].strftime('%Y-%m-%d %H:%M') if comment[2] else '-'
            comment_list.append({
                'id': comment[0],
                'comment': comment[1],
                'created_at': comment[2].isoformat() if comment[2] else None,
                'created_at_display': created_at_display,
                'user_nickname': comment[3] if comment[3] else '익명'
            })
        
        return render_template(
            'product_detail.html',
            product=product_detail,
            comments=comment_list,
            kakao_map_api=os.getenv('kakao_map_api')
        )
    except Exception as e:
        print(f"상품 상세 페이지 렌더링 중 오류: {e}")
        abort(500)

@app.route('/mypage')
def mypage():
    return render_template('mypage.html')

# API 라우트들

# 회원가입 API
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # 필수 필드 검증
        required_fields = ['email', 'password', 'nickname', 'confirmPassword', 'phone_number', 'sex', 'zip_code', 'address']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field}은(는) 필수입니다.'}), 400
        
        # 비밀번호 확인
        if data['password'] != data['confirmPassword']:
            return jsonify({'error': '비밀번호가 일치하지 않습니다.'}), 400
        
        # 이메일 및 닉네임 중복 확인
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT USER_ID FROM USER WHERE email = %s", (data['email'],))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': '이미 존재하는 이메일입니다.'}), 400
        
        cursor.execute("SELECT USER_ID FROM USER WHERE nickname = %s", (data['nickname'],))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': '이미 존재하는 닉네임입니다.'}), 400
        
        # 추가 유효성 검증
        cleaned_phone = re.sub(r'\D', '', data['phone_number'])
        if len(cleaned_phone) != 11:
            return jsonify({'error': '휴대폰 번호는 숫자 11자리여야 합니다.'}), 400
        formatted_phone = f"{cleaned_phone[:3]}-{cleaned_phone[3:7]}-{cleaned_phone[7:]}"
        
        allowed_sex = {'male', 'female', 'other'}
        if data['sex'] not in allowed_sex:
            return jsonify({'error': '성별 선택이 올바르지 않습니다.'}), 400
        
        full_address = data['address'].strip()
        if not full_address:
            return jsonify({'error': '주소가 올바르지 않습니다.'}), 400
        
        # 사용자 등록
        processed_password = process_password(data['password'])
        cursor.execute("""
            INSERT INTO USER (email, nickname, password, phone_number, zip_code, address, sex, money, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data['email'],
            data['nickname'],
            processed_password,
            formatted_phone,
            data['zip_code'],
            full_address,
            data['sex'],
            0,
            datetime.now()
        ))
        
        conn.commit()
        user_id = cursor.lastrowid
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': '회원가입이 완료되었습니다.',
            'user_id': user_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'회원가입 중 오류가 발생했습니다: {str(e)}'}), 500

# 로그인 API
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        # 필수 필드 검증
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': '이메일과 비밀번호를 입력해주세요.'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        processed_password = process_password(data['password'])
        
        # 먼저 일반 사용자 테이블에서 확인
        cursor.execute("""
            SELECT USER_ID, email, nickname, money, created_at FROM USER 
            WHERE email = %s AND password = %s
        """, (data['email'], processed_password))
        
        user = cursor.fetchone()
        
        if user:
            # 일반 사용자 로그인
            session['user_id'] = user[0]
            session['user_email'] = user[1]
            session['user_nickname'] = user[2]
            session['user_money'] = user[3]
            session['logged_in'] = True
            session['user_type'] = 'user'
            
            cursor.close()
            conn.close()
            
            return jsonify({
                'message': '로그인 성공',
                'user': {
                    'id': user[0],
                    'email': user[1],
                    'nickname': user[2],
                    'money': user[3],
                    'created_at': user[4].isoformat() if user[4] else None,
                    'type': 'user'
                }
            }), 200
        else:
            # 일반 사용자가 아니면 관리자 테이블 확인
            cursor.execute("""
                SELECT manager_id, position, created_at FROM manager 
                WHERE manager_id = %s AND manager_pw = %s
            """, (data['email'], processed_password))
            
            manager = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if manager:
                # 관리자 로그인
                session['user_id'] = manager[0]
                session['user_email'] = manager[0]
                session['user_nickname'] = f"관리자 ({manager[1]})"
                session['user_money'] = 0
                session['logged_in'] = True
                session['user_type'] = 'manager'
                
                return jsonify({
                    'message': '관리자 로그인 성공',
                    'user': {
                        'id': manager[0],
                        'email': manager[0],
                        'nickname': f"관리자 ({manager[1]})",
                        'money': 0,
                        'created_at': manager[2].isoformat() if manager[2] else None,
                        'type': 'manager',
                        'position': manager[1]
                    }
                }), 200
            else:
                return jsonify({'error': '이메일 또는 비밀번호가 올바르지 않습니다.'}), 401
            
    except Exception as e:
        return jsonify({'error': f'로그인 중 오류가 발생했습니다: {str(e)}'}), 500

# 로그아웃 API
@app.route('/api/logout', methods=['POST'])
def logout():
    try:
        # 세션에서 사용자 정보 제거
        session.pop('user_id', None)
        session.pop('user_email', None)
        session.pop('user_nickname', None)
        session.pop('user_money', None)
        session.pop('logged_in', None)
        
        return jsonify({'message': '로그아웃 성공'}), 200
        
    except Exception as e:
        return jsonify({'error': f'로그아웃 중 오류가 발생했습니다: {str(e)}'}), 500

# 세션 확인 API
@app.route('/api/check-session', methods=['GET'])
def check_session():
    try:
        if session.get('logged_in'):
            return jsonify({
                'logged_in': True,
                'user': {
                    'id': session.get('user_id'),
                    'email': session.get('user_email'),
                    'nickname': session.get('user_nickname'),
                    'money': session.get('user_money'),
                    'type': session.get('user_type', 'user')
                }
            }), 200
        else:
            return jsonify({'logged_in': False}), 200
            
    except Exception as e:
        return jsonify({'error': f'세션 확인 중 오류가 발생했습니다: {str(e)}'}), 500

# 상품 목록 API
@app.route('/api/products', methods=['GET'])
def get_products():
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.PRODUCT_ID, p.product_name, p.price, p.description, p.image_url, p.delivery_method, p.category, p.created_at, p.SELLER_ID, u.nickname
            FROM PRODUCT p
            JOIN USER u ON p.SELLER_ID = u.USER_ID
            WHERE p.is_sold = 0
            ORDER BY p.created_at DESC 
            LIMIT 5
        """)
        
        products = cursor.fetchall()
        cursor.close()
        conn.close()
        
        product_list = []
        for product in products:
            # 이미지 URL 처리 (LONGBLOB 데이터를 base64로 인코딩)
            image_url = None
            if product[4]:  # image_url (LONGBLOB)이 있는 경우
                image_base64 = base64.b64encode(product[4]).decode('utf-8')
                image_url = f"data:image/jpeg;base64,{image_base64}"
            
            product_list.append({
                'id': product[0],
                'title': product[1] if product[1] else '상품명 없음',
                'price': product[2] if product[2] else 0,
                'description': product[3] if product[3] else '',
                'image_url': image_url,
                'delivery_method': product[5] if product[5] else '배송 정보 없음',
                'category': product[6] if product[6] else '기타',
                'created_at': product[7].isoformat() if product[7] else None,
                'seller_id': product[8],
                'seller_nickname': product[9] if product[9] else '알 수 없음'
            })
        
        return jsonify({'products': product_list}), 200
        
    except Exception as e:
        return jsonify({'error': f'상품 목록 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 거래완료 상품 목록 API
@app.route('/api/sold-products', methods=['GET'])
def get_sold_products():
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.PRODUCT_ID, p.product_name, p.price, p.description, p.image_url, p.delivery_method, p.category, p.created_at, p.SELLER_ID, u.nickname
            FROM PRODUCT p
            JOIN USER u ON p.SELLER_ID = u.USER_ID
            WHERE p.is_sold = 1
            ORDER BY p.created_at DESC 
            LIMIT 5
        """)
        
        products = cursor.fetchall()
        cursor.close()
        conn.close()
        
        product_list = []
        for product in products:
            image_url = None
            if product[4]:  # image_url (LONGBLOB)이 있는 경우
                image_base64 = base64.b64encode(product[4]).decode('utf-8')
                image_url = f"data:image/jpeg;base64,{image_base64}"
            
            product_list.append({
                'id': product[0],
                'title': product[1] if product[1] else '상품명 없음',
                'price': product[2] if product[2] else 0,
                'description': product[3] if product[3] else '',
                'image_url': image_url,
                'delivery_method': product[5] if product[5] else '배송 정보 없음',
                'category': product[6] if product[6] else '기타',
                'created_at': product[7].isoformat() if product[7] else None,
                'seller_id': product[8],
                'seller_nickname': product[9] if product[9] else '알 수 없음',
                'is_sold': True
            })
        
        return jsonify({'products': product_list}), 200
        
    except Exception as e:
        return jsonify({'error': f'거래완료 상품 목록 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 구매한 상품 목록 API
@app.route('/api/purchased-products', methods=['GET'])
def get_purchased_products():
    try:
        # 세션에서 사용자 정보 확인
        if not session.get('logged_in'):
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        buyer_id = session.get('user_id')
        if not buyer_id:
            return jsonify({'error': '사용자 정보를 찾을 수 없습니다.'}), 401
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.PRODUCT_ID, p.product_name, p.price, p.description, p.image_url, p.delivery_method, p.category, p.created_at, p.SELLER_ID, u.nickname, t.transaction_date
            FROM PRODUCT p
            JOIN USER u ON p.SELLER_ID = u.USER_ID
            JOIN TRANSACTION t ON p.PRODUCT_ID = t.PRODUCT_ID
            WHERE t.BUYER_ID = %s
            ORDER BY t.transaction_date DESC 
            LIMIT 10
        """, (buyer_id,))
        
        products = cursor.fetchall()
        cursor.close()
        conn.close()
        
        product_list = []
        for product in products:
            image_url = None
            if product[4]:  # image_url (LONGBLOB)이 있는 경우
                image_base64 = base64.b64encode(product[4]).decode('utf-8')
                image_url = f"data:image/jpeg;base64,{image_base64}"
            
            product_list.append({
                'id': product[0],
                'title': product[1] if product[1] else '상품명 없음',
                'price': product[2] if product[2] else 0,
                'description': product[3] if product[3] else '',
                'image_url': image_url,
                'delivery_method': product[5] if product[5] else '배송 정보 없음',
                'category': product[6] if product[6] else '기타',
                'created_at': product[7].isoformat() if product[7] else None,
                'seller_id': product[8],
                'seller_nickname': product[9] if product[9] else '알 수 없음',
                'purchase_date': product[10].isoformat() if product[10] else None
            })
        
        return jsonify({'products': product_list}), 200
        
    except Exception as e:
        return jsonify({'error': f'구매한 상품 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 상품 상세 정보 API
@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product_detail(product_id):
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, created_at, SELLER_ID, is_sold,
                   meeting_zip_code, meeting_address, meeting_detail
            FROM PRODUCT 
            WHERE PRODUCT_ID = %s
        """, (product_id,))
        
        product = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not product:
            return jsonify({'error': '상품을 찾을 수 없습니다.'}), 404
        
        # 이미지 URL 처리 (LONGBLOB 데이터를 base64로 인코딩)
        image_url = None
        if product[4]:  # image_url (LONGBLOB)이 있는 경우
            image_base64 = base64.b64encode(product[4]).decode('utf-8')
            image_url = f"data:image/jpeg;base64,{image_base64}"
        
        # 판매자 정보 조회
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT nickname FROM USER WHERE USER_ID = %s", (product[7],))
            seller = cursor.fetchone()
            cursor.close()
            conn.close()
            seller_nickname = seller[0] if seller else "알 수 없음"
        else:
            seller_nickname = "알 수 없음"
        
        product_detail = {
            'id': product[0],
            'title': product[1],
            'price': product[2],
            'description': product[3],
            'image_url': image_url,
            'delivery_method': product[5],
            'created_at': product[6].isoformat() if product[6] else None,
            'seller_id': product[7],
            'seller_nickname': seller_nickname,
            'is_sold': bool(product[8]),
            'meeting_zip_code': product[9],
            'meeting_address': product[10],
            'meeting_detail': product[11]
        }
        
        return jsonify({'product': product_detail}), 200
        
    except Exception as e:
        return jsonify({'error': f'상품 상세 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 댓글 등록 API
@app.route('/api/comments', methods=['POST'])
def create_comment():
    try:
        # 세션에서 사용자 정보 확인
        if not session.get('logged_in'):
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        data = request.get_json()
        product_id = data.get('product_id')
        comment = data.get('comment')
        
        if not product_id or not comment:
            return jsonify({'error': '상품 ID와 댓글 내용이 필요합니다.'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO COMMENTS (PRODUCT_ID, USER_ID, comment)
            VALUES (%s, %s, %s)
        """, (product_id, session.get('user_id'), comment))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': '댓글이 등록되었습니다.'}), 201
        
    except Exception as e:
        return jsonify({'error': f'댓글 등록 중 오류가 발생했습니다: {str(e)}'}), 500

# 댓글 조회 API
@app.route('/api/comments/<int:product_id>', methods=['GET'])
def get_comments(product_id):
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.COMMENT_ID, c.comment, c.created_at, u.nickname as user_nickname
            FROM COMMENTS c
            JOIN USER u ON c.USER_ID = u.USER_ID
            WHERE c.PRODUCT_ID = %s
            ORDER BY c.created_at DESC
        """, (product_id,))
        
        comments = cursor.fetchall()
        cursor.close()
        conn.close()
        
        comment_list = []
        for comment in comments:
            comment_list.append({
                'id': comment[0],
                'comment': comment[1],
                'created_at': comment[2].isoformat() if comment[2] else None,
                'user_nickname': comment[3]
            })
        
        return jsonify({'comments': comment_list}), 200
        
    except Exception as e:
        return jsonify({'error': f'댓글 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 상품 등록 API
@app.route('/api/products', methods=['POST'])
def create_product():
    try:
        # 필수 필드 검증
        if 'title' not in request.form or not request.form['title']:
            return jsonify({'error': '상품 제목을 입력해주세요.'}), 400
        
        if 'price' not in request.form or not request.form['price']:
            return jsonify({'error': '가격을 입력해주세요.'}), 400
        
        if 'delivery' not in request.form or not request.form['delivery']:
            return jsonify({'error': '배송 방법을 선택해주세요.'}), 400
        
        if 'description' not in request.form or not request.form['description']:
            return jsonify({'error': '상품 설명을 입력해주세요.'}), 400
        
        if 'category' not in request.form or not request.form['category']:
            return jsonify({'error': '카테고리를 선택해주세요.'}), 400
        
        if 'image' not in request.files or not request.files['image'].filename:
            return jsonify({'error': '상품 이미지를 선택해주세요.'}), 400
        
        # 세션에서 사용자 정보 확인
        if not session.get('logged_in'):
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        seller_id = session.get('user_id')
        if not seller_id:
            return jsonify({'error': '사용자 정보를 찾을 수 없습니다.'}), 401
        
        # 데이터 추출
        title = request.form['title']
        price = int(request.form['price'])
        delivery = request.form['delivery']
        description = request.form['description']
        category = request.form['category']
        image_file = request.files['image']
        meeting_zip_code = request.form.get('meeting_zip_code', '').strip()
        meeting_address = request.form.get('meeting_address', '').strip()
        meeting_detail = request.form.get('meeting_detail', '').strip()
        
        if not meeting_zip_code or not meeting_address:
            return jsonify({'error': '거래 주소를 입력해주세요.'}), 400
        
        # 가격 유효성 검사
        if price < 0:
            return jsonify({'error': '가격은 0원 이상이어야 합니다.'}), 400
        
        # 이미지 파일 검증
        if not image_file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
            return jsonify({'error': '이미지 파일만 업로드 가능합니다.'}), 400
        
        # 데이터베이스 연결
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        
        # 판매자 존재 확인
        cursor.execute("SELECT USER_ID FROM USER WHERE USER_ID = %s", (seller_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404
        
        # 이미지 파일을 LONGBLOB으로 변환
        image_data = image_file.read()
        
        # 상품 등록 (이미지를 LONGBLOB으로 저장)
        cursor.execute("""
            INSERT INTO PRODUCT (
                SELLER_ID, product_name, price, description, image_url,
                delivery_method, category, meeting_zip_code, meeting_address,
                meeting_detail, created_at, is_sold
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            seller_id,
            title,
            price,
            description,
            image_data,
            delivery,
            category,
            meeting_zip_code,
            meeting_address,
            meeting_detail,
            datetime.now(),
            0
        ))
        
        product_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': '상품이 성공적으로 등록되었습니다.',
            'product_id': product_id
        }), 201
        
    except ValueError:
        return jsonify({'error': '올바른 가격을 입력해주세요.'}), 400
    except Exception as e:
        return jsonify({'error': f'상품 등록 중 오류가 발생했습니다: {str(e)}'}), 500


# 내 상품 목록 조회 API
@app.route('/api/user/products', methods=['GET'])
def get_user_products():
    try:
        # 세션에서 사용자 정보 확인
        if not session.get('logged_in'):
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold
            FROM PRODUCT 
            WHERE SELLER_ID = %s
            ORDER BY created_at DESC
        """, (session.get('user_id'),))
        
        products = cursor.fetchall()
        cursor.close()
        conn.close()
        
        product_list = []
        for product in products:
            # 이미지 URL 처리 (LONGBLOB 데이터를 base64로 인코딩)
            image_url = None
            if product[4]:  # image_url (LONGBLOB)이 있는 경우
                image_base64 = base64.b64encode(product[4]).decode('utf-8')
                image_url = f"data:image/jpeg;base64,{image_base64}"
            
            product_list.append({
                'id': product[0],
                'title': product[1] if product[1] else '상품명 없음',
                'price': product[2] if product[2] else 0,
                'description': product[3] if product[3] else '',
                'image_url': image_url,
                'delivery_method': product[5] if product[5] else '배송 정보 없음',
                'category': product[6] if product[6] else '기타',
                'created_at': product[7].isoformat() if product[7] else None,
                'is_sold': bool(product[8])
            })
        
        return jsonify({'products': product_list}), 200
        
    except Exception as e:
        return jsonify({'error': f'내 상품 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 마이페이지 API (추후 구현)
@app.route('/api/user/profile', methods=['GET'])
def get_user_profile():
    return jsonify({'message': '마이페이지 기능은 추후 구현될 예정입니다.'}), 501

# 게시판 API는 아래에서 구현됨

# 금액 충전 API
@app.route('/api/charge', methods=['POST'])
def charge_money():
    try:
        data = request.get_json()
        
        # 필수 필드 검증
        if not data.get('amount'):
            return jsonify({'error': '충전할 금액을 입력해주세요.'}), 400
        
        amount = int(data['amount'])
        
        # 금액 유효성 검사
        if amount < 1000:
            return jsonify({'error': '최소 충전 금액은 1,000원입니다.'}), 400
        
        if amount > 1000000:
            return jsonify({'error': '최대 충전 금액은 1,000,000원입니다.'}), 400
        
        # 세션에서 사용자 정보 확인
        if not session.get('logged_in'):
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': '사용자 정보를 찾을 수 없습니다.'}), 401
        
        # 데이터베이스 연결
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        
        # 사용자 존재 확인
        cursor.execute("SELECT USER_ID, money FROM USER WHERE USER_ID = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404
        
        # 현재 금액에 충전 금액 추가
        new_money = user[1] + amount
        
        # DB 업데이트
        cursor.execute("""
            UPDATE USER SET money = %s WHERE USER_ID = %s
        """, (new_money, user_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': '충전이 완료되었습니다.',
            'charged_amount': amount,
            'new_balance': new_money
        }), 200
        
    except ValueError:
        return jsonify({'error': '올바른 금액을 입력해주세요.'}), 400
    except Exception as e:
        return jsonify({'error': f'충전 중 오류가 발생했습니다: {str(e)}'}), 500

# 구매 API
@app.route('/api/purchase', methods=['POST'])
def purchase_product():
    try:
        data = request.get_json()
        
        # 필수 필드 검증
        if not data.get('product_id'):
            return jsonify({'error': '상품 정보가 필요합니다.'}), 400
        
        product_id = int(data['product_id'])
        
        # 세션에서 사용자 정보 확인
        if not session.get('logged_in'):
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        buyer_id = session.get('user_id')
        if not buyer_id:
            return jsonify({'error': '사용자 정보를 찾을 수 없습니다.'}), 401
        
        # 데이터베이스 연결
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        
        # 상품 정보 조회
        cursor.execute("""
            SELECT PRODUCT_ID, SELLER_ID, product_name, price, is_sold
            FROM PRODUCT 
            WHERE PRODUCT_ID = %s
        """, (product_id,))
        
        product = cursor.fetchone()
        if not product:
            cursor.close()
            conn.close()
            return jsonify({'error': '상품을 찾을 수 없습니다.'}), 404
        
        # 이미 판매된 상품인지 확인
        if product[4]:  # is_sold가 1인 경우
            cursor.close()
            conn.close()
            return jsonify({'error': '이미 판매된 상품입니다.'}), 400
        
        # 본인 상품인지 확인
        if product[1] == buyer_id:  # SELLER_ID와 buyer_id가 같은 경우
            cursor.close()
            conn.close()
            return jsonify({'error': '본인의 상품은 구매할 수 없습니다.'}), 400
        
        product_price = product[3]  # price
        
        # 구매자 잔액 확인
        cursor.execute("SELECT money FROM USER WHERE USER_ID = %s", (buyer_id,))
        buyer = cursor.fetchone()
        if not buyer:
            cursor.close()
            conn.close()
            return jsonify({'error': '구매자 정보를 찾을 수 없습니다.'}), 404
        
        buyer_money = buyer[0]
        if buyer_money < product_price:
            cursor.close()
            conn.close()
            return jsonify({'error': '금액이 부족합니다.'}), 400
        
        # 거래 처리 (트랜잭션)
        try:
            # 구매자 잔액 차감
            new_buyer_money = buyer_money - product_price
            cursor.execute("UPDATE USER SET money = %s WHERE USER_ID = %s", (new_buyer_money, buyer_id))
            
            # 판매자 잔액 증가
            cursor.execute("SELECT money FROM USER WHERE USER_ID = %s", (product[1],))
            seller = cursor.fetchone()
            if seller:
                seller_money = seller[0]
                new_seller_money = seller_money + product_price
                cursor.execute("UPDATE USER SET money = %s WHERE USER_ID = %s", (new_seller_money, product[1]))
            
            # 상품 판매 완료 처리
            cursor.execute("UPDATE PRODUCT SET is_sold = 1 WHERE PRODUCT_ID = %s", (product_id,))
            
            # 거래 기록 생성
            cursor.execute("""
                INSERT INTO TRANSACTION (PRODUCT_ID, BUYER_ID, transaction_date)
                VALUES (%s, %s, %s)
            """, (product_id, buyer_id, datetime.now()))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return jsonify({
                'message': '구매가 완료되었습니다.',
                'product_name': product[2],
                'price': product_price,
                'remaining_balance': new_buyer_money
            }), 200
            
        except Exception as e:
            conn.rollback()
            cursor.close()
            conn.close()
            return jsonify({'error': f'거래 처리 중 오류가 발생했습니다: {str(e)}'}), 500
        
    except ValueError:
        return jsonify({'error': '올바른 상품 정보를 입력해주세요.'}), 400
    except Exception as e:
        return jsonify({'error': f'구매 중 오류가 발생했습니다: {str(e)}'}), 500
     
##########################S3연동 관련 코드들###########################

@app.route('/s3')
def s3():
    return render_template('s3.html')

def s3_connection():
    try:
        # s3 클라이언트 생성
        s3 = boto3.client(
            service_name="s3",
            region_name="ap-northeast-2",
            aws_access_key_id="{액세스 키 ID}",
            aws_secret_access_key="{비밀 액세스 키}",
        )
    except Exception as e:
        print(e)
    else:
        print("s3 bucket connected!") 
        return s3
        
    

@app.route('/api/products/category/<category>', methods=['GET'])
def get_products_by_category(category):
    try:
        # 쿼리 파라미터에서 페이징 정보 추출
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 5))
        offset = (page - 1) * per_page

        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500

        cursor = conn.cursor()

        # 전체 상품 수 조회
        if category == 'all':
            cursor.execute("""
                SELECT COUNT(*) FROM PRODUCT WHERE is_sold = 0
            """)
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM PRODUCT WHERE category = %s AND is_sold = 0
            """, (category,))
        
        total_count = cursor.fetchone()[0]
        total_pages = (total_count + per_page - 1) // per_page

        # 상품 조회 (페이징 적용)
        if category == 'all':
            cursor.execute("""
                SELECT p.PRODUCT_ID, p.product_name, p.price, p.image_url, p.delivery_method, p.category, p.created_at, p.is_sold,
                       u.nickname as seller_nickname
                FROM PRODUCT p
                LEFT JOIN USER u ON p.SELLER_ID = u.USER_ID
                WHERE p.is_sold = 0
                ORDER BY p.created_at DESC
                LIMIT %s OFFSET %s
            """, (per_page, offset))
        else:
            cursor.execute("""
                SELECT p.PRODUCT_ID, p.product_name, p.price, p.image_url, p.delivery_method, p.category, p.created_at, p.is_sold,
                       u.nickname as seller_nickname
                FROM PRODUCT p
                LEFT JOIN USER u ON p.SELLER_ID = u.USER_ID
                WHERE p.category = %s AND p.is_sold = 0
                ORDER BY p.created_at DESC
                LIMIT %s OFFSET %s
            """, (category, per_page, offset))

        products = cursor.fetchall()
        cursor.close()
        conn.close()

        # 상품 정보를 딕셔너리로 변환
        product_list = []
        for product in products:
            # 이미지 데이터 처리 (LONGBLOB -> Base64 또는 None)
            image_data = product[3]
            if image_data and isinstance(image_data, bytes):
                import base64
                image_url = f"data:image/jpeg;base64,{base64.b64encode(image_data).decode('utf-8')}"
            else:
                image_url = None
                
            product_dict = {
                'id': product[0],
                'title': product[1] if product[1] else '상품명 없음',
                'price': product[2] if product[2] else 0,
                'image_url': image_url,
                'delivery_method': product[4] if product[4] else '배송 정보 없음',
                'category': product[5] if product[5] else '기타',
                'created_at': product[6].isoformat() if product[6] else None,
                'is_sold': bool(product[7]),
                'seller_nickname': product[8] if product[8] else '판매자 정보 없음'
            }
            product_list.append(product_dict)

        return jsonify({
            'products': product_list,
            'category': category,
            'total': total_count,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }), 200

    except Exception as e:
        return jsonify({'error': f'카테고리별 상품 조회 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/products/category-stats', methods=['GET'])
def get_category_stats():
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500

        cursor = conn.cursor()

        # 카테고리별 상품 수 조회 (판매중인 상품만)
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM PRODUCT
            WHERE is_sold = 0
            GROUP BY category
        """)

        stats = cursor.fetchall()
        cursor.close()
        conn.close()

        # 전체 상품 수 조회
        total_count = sum(stat[1] for stat in stats)

        # 카테고리별 통계를 딕셔너리로 변환
        category_stats = {'all': total_count}
        for stat in stats:
            category_stats[stat[0]] = stat[1]

        return jsonify({
            'stats': category_stats
        }), 200

    except Exception as e:
        return jsonify({'error': f'카테고리 통계 조회 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/sold-products/paged', methods=['GET'])
def get_sold_products_paged():
    try:
        # 쿼리 파라미터에서 페이징 정보와 카테고리 추출
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 5))
        category = request.args.get('category', None)
        offset = (page - 1) * per_page

        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500

        cursor = conn.cursor()

        # 카테고리 필터링 조건 설정
        category_condition = ""
        category_params = []
        if category and category != 'all':
            category_condition = " AND p.category = %s"
            category_params.append(category)

        # 거래완료 상품 수 조회
        count_query = f"""
            SELECT COUNT(*) FROM PRODUCT p
            WHERE p.is_sold = 1{category_condition}
        """
        cursor.execute(count_query, category_params)
        total_count = cursor.fetchone()[0]
        total_pages = (total_count + per_page - 1) // per_page

        # 거래완료 상품 조회 (페이징 적용)
        query = f"""
            SELECT p.PRODUCT_ID, p.product_name, p.price, p.image_url, p.delivery_method, p.category, p.created_at, p.is_sold,
                   u.nickname as seller_nickname
            FROM PRODUCT p
            LEFT JOIN USER u ON p.SELLER_ID = u.USER_ID
            WHERE p.is_sold = 1{category_condition}
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s
        """
        cursor.execute(query, category_params + [per_page, offset])

        products = cursor.fetchall()
        cursor.close()
        conn.close()

        # 상품 정보를 딕셔너리로 변환
        product_list = []
        for product in products:
            # 이미지 데이터 처리 (LONGBLOB -> Base64 또는 None)
            image_data = product[3]
            if image_data and isinstance(image_data, bytes):
                import base64
                image_url = f"data:image/jpeg;base64,{base64.b64encode(image_data).decode('utf-8')}"
            else:
                image_url = None
                
            product_dict = {
                'id': product[0],
                'title': product[1] if product[1] else '상품명 없음',
                'price': product[2] if product[2] else 0,
                'image_url': image_url,
                'delivery_method': product[4] if product[4] else '배송 정보 없음',
                'category': product[5] if product[5] else '기타',
                'created_at': product[6].isoformat() if product[6] else None,
                'is_sold': bool(product[7]),
                'seller_nickname': product[8] if product[8] else '판매자 정보 없음'
            }
            product_list.append(product_dict)

        return jsonify({
            'products': product_list,
            'total': total_count,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }), 200

    except Exception as e:
        return jsonify({'error': f'거래완료 상품 조회 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/products')
def products():
    return render_template('products.html')

@app.route('/product/register')
def product_register():
    # 로그인 확인
    if not session.get('logged_in'):
        return render_template('login.html')
    return render_template('product_register.html', kakao_map_api=os.getenv('kakao_map_api'))

@app.route('/board')
def board():
    return render_template('board.html')

@app.route('/admin')
def admin_dashboard():
    # 관리자 권한 확인
    if not session.get('logged_in') or session.get('user_type') != 'manager':
        return render_template('index.html')  # 관리자가 아니면 메인 페이지로 리다이렉트
    return render_template('admin_dashboard.html')

@app.route('/admin/users')
def user_management():
    # 관리자 권한 확인
    if not session.get('logged_in') or session.get('user_type') != 'manager':
        return render_template('index.html')  # 관리자가 아니면 메인 페이지로 리다이렉트
    return render_template('user_management.html')

@app.route('/admin/product-stats')
def product_stats():
    # 관리자 권한 확인
    if not session.get('logged_in') or session.get('user_type') != 'manager':
        return render_template('index.html')  # 관리자가 아니면 메인 페이지로 리다이렉트
    return render_template('product_stats.html')

@app.route('/admin/products')
def admin_products():
    # 관리자 권한 확인
    if not session.get('logged_in') or session.get('user_type') != 'manager':
        return render_template('index.html')  # 관리자가 아니면 메인 페이지로 리다이렉트
    return render_template('admin_products.html')


# 게시판 API 라우트들
@app.route('/api/board', methods=['GET'])
def get_board_posts_list():
    """게시판 글 목록 조회"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        offset = (page - 1) * per_page
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # 전체 글 수 조회 (활성화된 게시글만)
        cursor.execute("SELECT COUNT(*) as total FROM QNA WHERE is_active = 0")
        total = cursor.fetchone()['total']
        
        # 게시글 목록 조회 (활성화된 게시글만, 최신순)
        query = """
        SELECT q.QNA_ID, q.title, q.question, q.view_count, 
               q.created_at, q.updated_at, u.nickname as author
        FROM QNA q
        JOIN USER u ON q.USER_ID = u.USER_ID
        WHERE q.is_active = 0
        ORDER BY q.created_at DESC
        LIMIT %s OFFSET %s
        """
        cursor.execute(query, (per_page, offset))
        posts = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'posts': posts,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'게시판 글 조회 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/board', methods=['POST'])
def create_board_post():
    """게시판 글 작성"""
    try:
        data = request.get_json()
        title = data.get('title')
        content = data.get('content')
        
        if not title or not content:
            return jsonify({'error': '제목과 내용을 모두 입력해주세요'}), 400
        
        # 세션에서 사용자 ID 확인
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': '로그인이 필요합니다'}), 401
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor()
        
        # 게시글 작성
        query = """
        INSERT INTO QNA (USER_ID, title, question, created_at, is_active)
        VALUES (%s, %s, %s, NOW(), 0)
        """
        cursor.execute(query, (user_id, title, content))
        connection.commit()
        
        post_id = cursor.lastrowid
        cursor.close()
        connection.close()
        
        return jsonify({'message': '게시글이 성공적으로 작성되었습니다', 'post_id': post_id}), 201
        
    except Exception as e:
        return jsonify({'error': f'게시글 작성 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/board/<int:post_id>', methods=['GET'])
def get_board_post(post_id):
    """게시판 글 상세 조회"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # 조회수 증가
        cursor.execute("UPDATE QNA SET view_count = view_count + 1 WHERE QNA_ID = %s", (post_id,))
        
        # 게시글 상세 조회 (활성화된 게시글만)
        query = """
        SELECT q.QNA_ID, q.title, q.question, q.answer, q.view_count,
               q.created_at, q.updated_at, u.nickname as author
        FROM QNA q
        JOIN USER u ON q.USER_ID = u.USER_ID
        WHERE q.QNA_ID = %s AND q.is_active = 0
        """
        cursor.execute(query, (post_id,))
        post = cursor.fetchone()
        
        connection.commit()
        cursor.close()
        connection.close()
        
        if not post:
            return jsonify({'error': '게시글을 찾을 수 없습니다'}), 404
        
        return jsonify({'post': post}), 200
        
    except Exception as e:
        return jsonify({'error': f'게시글 조회 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/board/<int:post_id>/answer', methods=['POST'])
def create_board_answer(post_id):
    """게시글 답변 작성"""
    try:
        data = request.get_json()
        answer = data.get('answer')
        
        if not answer:
            return jsonify({'error': '답변 내용을 입력해주세요'}), 400
        
        # 세션에서 사용자 ID 확인
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': '로그인이 필요합니다'}), 401
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor()
        
        # 답변 작성
        query = """
        UPDATE QNA SET answer = %s, updated_at = NOW()
        WHERE QNA_ID = %s
        """
        cursor.execute(query, (answer, post_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'message': '답변이 성공적으로 등록되었습니다'}), 201
        
    except Exception as e:
        return jsonify({'error': f'답변 등록 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/board/<int:post_id>', methods=['DELETE'])
def delete_board_post(post_id):
    """관리자용 게시글 삭제"""
    try:
        # 관리자 권한 확인
        if not session.get('logged_in') or session.get('user_type') != 'manager':
            return jsonify({'error': '관리자 권한이 필요합니다'}), 403
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor()
        
        # 게시글 존재 확인
        cursor.execute("SELECT QNA_ID, title FROM QNA WHERE QNA_ID = %s", (post_id,))
        post = cursor.fetchone()
        
        if not post:
            cursor.close()
            connection.close()
            return jsonify({'error': '게시글을 찾을 수 없습니다'}), 404
        
        # 게시글 비활성화 (is_active를 1로 변경)
        cursor.execute("UPDATE QNA SET is_active = 1 WHERE QNA_ID = %s", (post_id,))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'message': f'게시글 "{post[1]}"이 성공적으로 삭제되었습니다'}), 200
        
    except Exception as e:
        return jsonify({'error': f'게시글 삭제 중 오류가 발생했습니다: {str(e)}'}), 500

# 관리자 API
@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    """관리자 통계 조회"""
    try:
        # 관리자 권한 확인
        if not session.get('logged_in') or session.get('user_type') != 'manager':
            return jsonify({'error': '관리자 권한이 필요합니다'}), 403
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor()
        
        # 각 테이블의 총 개수 조회
        stats = {}
        
        # 총 사용자 수
        cursor.execute("SELECT COUNT(*) FROM USER")
        stats['total_users'] = cursor.fetchone()[0]
        
        # 총 상품 수
        cursor.execute("SELECT COUNT(*) FROM PRODUCT")
        stats['total_products'] = cursor.fetchone()[0]
        
        # 총 거래 수
        cursor.execute("SELECT COUNT(*) FROM TRANSACTION")
        stats['total_transactions'] = cursor.fetchone()[0]
        
        # 총 게시글 수 (활성화된 게시글만)
        cursor.execute("SELECT COUNT(*) FROM QNA WHERE is_active = 0")
        stats['total_posts'] = cursor.fetchone()[0]
        
        cursor.close()
        connection.close()
        
        return jsonify(stats), 200
        
    except Exception as e:
        return jsonify({'error': f'관리자 통계 조회 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/admin/activity', methods=['GET'])
def get_admin_activity():
    """관리자 최근 활동 조회"""
    try:
        # 관리자 권한 확인
        if not session.get('logged_in') or session.get('user_type') != 'manager':
            return jsonify({'error': '관리자 권한이 필요합니다'}), 403
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # 최근 활동 조회 (최근 10개)
        activities = []
        
        # 최근 상품 등록
        cursor.execute("""
            SELECT 'product' as type, '새 상품 등록' as title, 
                   CONCAT('"', product_name, '" 상품이 등록되었습니다.') as description,
                   created_at
            FROM PRODUCT 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        activities.extend(cursor.fetchall())
        
        # 최근 게시글 (활성화된 게시글만)
        cursor.execute("""
            SELECT 'post' as type, '새 게시글 작성' as title,
                   CONCAT('"', title, '" 게시글이 작성되었습니다.') as description,
                   created_at
            FROM QNA 
            WHERE is_active = 0
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        activities.extend(cursor.fetchall())
        
        # 시간순으로 정렬하고 최근 10개만 선택
        activities.sort(key=lambda x: x['created_at'], reverse=True)
        activities = activities[:10]
        
        cursor.close()
        connection.close()
        
        return jsonify(activities), 200
        
    except Exception as e:
        return jsonify({'error': f'관리자 활동 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 사용자 관리 API
@app.route('/api/admin/users', methods=['GET'])
def get_admin_users():
    """관리자용 사용자 목록 조회"""
    try:
        # 관리자 권한 확인
        if not session.get('logged_in') or session.get('user_type') != 'manager':
            return jsonify({'error': '관리자 권한이 필요합니다'}), 403
        
        # 검색 파라미터
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        offset = (page - 1) * per_page
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # 검색 조건 설정
        search_condition = ""
        search_params = []
        if search:
            search_condition = " AND (email LIKE %s OR nickname LIKE %s)"
            search_params = [f"%{search}%", f"%{search}%"]
        
        # 전체 사용자 수 조회
        count_query = f"""
            SELECT COUNT(*) as total FROM USER 
            WHERE 1=1{search_condition}
        """
        cursor.execute(count_query, search_params)
        total = cursor.fetchone()['total']
        
        # 사용자 목록 조회
        query = f"""
            SELECT USER_ID, email, nickname, money, created_at, is_active
            FROM USER 
            WHERE 1=1{search_condition}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        cursor.execute(query, search_params + [per_page, offset])
        users = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'users': users,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'사용자 목록 조회 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
def update_admin_user(user_id):
    """관리자용 사용자 정보 수정"""
    try:
        # 관리자 권한 확인
        if not session.get('logged_in') or session.get('user_type') != 'manager':
            return jsonify({'error': '관리자 권한이 필요합니다'}), 403
        
        data = request.get_json()
        email = data.get('email')
        nickname = data.get('nickname')
        money = data.get('money')
        
        # 필수 필드 검증
        if not email or not nickname or money is None:
            return jsonify({'error': '이메일, 닉네임, 보유금액은 필수입니다'}), 400
        
        # 금액 유효성 검사
        if money < 0:
            return jsonify({'error': '보유금액은 0원 이상이어야 합니다'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor()
        
        # 사용자 존재 확인
        cursor.execute("SELECT USER_ID FROM USER WHERE USER_ID = %s", (user_id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': '사용자를 찾을 수 없습니다'}), 404
        
        # 이메일 중복 확인 (본인 제외)
        cursor.execute("SELECT USER_ID FROM USER WHERE email = %s AND USER_ID != %s", (email, user_id))
        if cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': '이미 존재하는 이메일입니다'}), 400
        
        # 닉네임 중복 확인 (본인 제외)
        cursor.execute("SELECT USER_ID FROM USER WHERE nickname = %s AND USER_ID != %s", (nickname, user_id))
        if cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': '이미 존재하는 닉네임입니다'}), 400
        
        # 사용자 정보 업데이트
        cursor.execute("""
            UPDATE USER SET email = %s, nickname = %s, money = %s
            WHERE USER_ID = %s
        """, (email, nickname, money, user_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'message': '사용자 정보가 성공적으로 수정되었습니다'}), 200
        
    except Exception as e:
        return jsonify({'error': f'사용자 정보 수정 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def delete_admin_user(user_id):
    """관리자용 사용자 삭제 (비활성화)"""
    try:
        # 관리자 권한 확인
        if not session.get('logged_in') or session.get('user_type') != 'manager':
            return jsonify({'error': '관리자 권한이 필요합니다'}), 403
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor()
        
        # 사용자 존재 확인
        cursor.execute("SELECT USER_ID, nickname FROM USER WHERE USER_ID = %s", (user_id,))
        user = cursor.fetchone()
        if not user:
            cursor.close()
            connection.close()
            return jsonify({'error': '사용자를 찾을 수 없습니다'}), 404
        
        # 사용자 비활성화 (is_active를 0으로 설정)
        cursor.execute("UPDATE USER SET is_active = 0 WHERE USER_ID = %s", (user_id,))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'message': f'사용자 "{user[1]}"가 성공적으로 삭제되었습니다'}), 200
        
    except Exception as e:
        return jsonify({'error': f'사용자 삭제 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/admin/product-stats', methods=['GET'])
def get_product_stats():
    """상품 통계 조회"""
    try:
        if not session.get('logged_in') or session.get('user_type') != 'manager':
            return jsonify({'error': '관리자 권한이 필요합니다'}), 403
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor()
        
        # 전체 상품 수
        cursor.execute("SELECT COUNT(*) FROM PRODUCT")
        total_products = cursor.fetchone()[0]
        
        # 카테고리별 상품 수
        cursor.execute("""
            SELECT category, COUNT(*) as count 
            FROM PRODUCT 
            GROUP BY category 
            ORDER BY count DESC
        """)
        category_stats = cursor.fetchall()
        
        # 배송방법별 상품 수
        cursor.execute("""
            SELECT delivery_method, COUNT(*) as count 
            FROM PRODUCT 
            GROUP BY delivery_method 
            ORDER BY count DESC
        """)
        delivery_stats = cursor.fetchall()
        
        # 카테고리별 가격 통계
        cursor.execute("""
            SELECT 
                category,
                COUNT(*) as count,
                MAX(price) as max_price,
                MIN(price) as min_price,
                AVG(price) as avg_price
            FROM PRODUCT 
            GROUP BY category 
            ORDER BY category
        """)
        price_stats = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'total_products': total_products,
            'total_categories': len(category_stats),
            'total_delivery_methods': len(delivery_stats),
            'category_stats': [{'category': row[0], 'count': row[1]} for row in category_stats],
            'delivery_stats': [{'delivery_method': row[0], 'count': row[1]} for row in delivery_stats],
            'price_stats': [{
                'category': row[0], 
                'count': row[1], 
                'max_price': int(row[2]), 
                'min_price': int(row[3]), 
                'avg_price': int(row[4])
            } for row in price_stats]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'상품 통계 조회 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/admin/products', methods=['GET'])
def get_admin_products():
    """관리자용 상품 목록 조회"""
    try:
        if not session.get('logged_in') or session.get('user_type') != 'manager':
            return jsonify({'error': '관리자 권한이 필요합니다'}), 403
        
        # 쿼리 파라미터
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        category = request.args.get('category', 'all')
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor()
        
        # 카테고리 필터링 조건
        where_clause = ""
        params = []
        if category != 'all':
            where_clause = "WHERE category = %s"
            params.append(category)
        
        # 전체 상품 수 조회
        count_query = f"SELECT COUNT(*) FROM PRODUCT {where_clause}"
        cursor.execute(count_query, params)
        total_products = cursor.fetchone()[0]
        
        # 상품 목록 조회 (이미지 제외)
        offset = (page - 1) * per_page
        query = f"""
            SELECT 
                PRODUCT_ID,
                product_name,
                category,
                price,
                delivery_method,
                description,
                created_at,
                SELLER_ID
            FROM PRODUCT 
            {where_clause}
            ORDER BY created_at DESC 
            LIMIT %s OFFSET %s
        """
        params.extend([per_page, offset])
        cursor.execute(query, params)
        products = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # 상품 데이터 포맷팅
        products_list = []
        for product in products:
            products_list.append({
                'PRODUCT_ID': product[0],
                'title': product[1],
                'category': product[2],
                'price': product[3],
                'delivery_method': product[4],
                'description': product[5],
                'created_at': product[6].isoformat() if product[6] else None,
                'USER_ID': product[7]
            })
        
        total_pages = (total_products + per_page - 1) // per_page
        
        return jsonify({
            'products': products_list,
            'total': total_products,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages,
            'current_category': category
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'상품 목록 조회 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/admin/products/<int:product_id>', methods=['DELETE'])
def delete_admin_product(product_id):
    """관리자용 상품 삭제"""
    try:
        if not session.get('logged_in') or session.get('user_type') != 'manager':
            return jsonify({'error': '관리자 권한이 필요합니다'}), 403
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': '데이터베이스 연결 실패'}), 500
        
        cursor = connection.cursor()
        
        # 상품 존재 확인
        cursor.execute("SELECT PRODUCT_ID, product_name FROM PRODUCT WHERE PRODUCT_ID = %s", (product_id,))
        product = cursor.fetchone()
        
        if not product:
            cursor.close()
            connection.close()
            return jsonify({'error': '상품을 찾을 수 없습니다'}), 404
        
        # 상품 삭제
        cursor.execute("DELETE FROM PRODUCT WHERE PRODUCT_ID = %s", (product_id,))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({'message': f'상품 "{product[1]}"이 성공적으로 삭제되었습니다'}), 200
        
    except Exception as e:
        return jsonify({'error': f'상품 삭제 중 오류가 발생했습니다: {str(e)}'}), 500


############### S3 관련 ##################

# 파일 업로드 용량 최대 16MB로 제한
app.config['MAX_CONTENT_LENGTH'] = 16*1024*1024

# S3 관련 환경 변수
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
S3_REGION = os.getenv('S3_REGION')

# S3 클라이언트 초기화
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=S3_REGION
)


@app.route('/writing')
def writing():
    return render_template('writing.html')

##############################################
# 자연어 → SQL 기반 검색 (LLM이 직접 SQL 생성)
##############################################

def generate_sql_with_llm(nl_query: str):
    """LLM에게 자연어 질의를 주고 SQL을 생성하도록 요청한다."""
    try:
        api_key = os.getenv('open_api_key')
        if not api_key:
            raise RuntimeError('OPENAI API KEY missing')

        client = OpenAI(api_key=api_key)
        
        # 테이블 스키마 정보
        schema_info = """
        PRODUCT 테이블 스키마:
        - PRODUCT_ID (int): 상품 ID
        - product_name (text): 상품명
        - price (int): 가격 (원 단위)
        - description (text): 상품 설명
        - image_url (LONGBLOB): 상품 이미지
        - delivery_method (text): 배송방법 ('CU편의점 택배', 'GS편의점 택배', '7ELEVEN 택배', '우체국 택배')
        - category (text): 카테고리 ('의류', '전자기기', '기타')
        - created_at (datetime): 등록일시
        - is_sold (int): 판매완료 여부 (0: 판매중, 1: 판매완료)
        - SELLER_ID (int): 판매자 ID
        """
        
        system_prompt = f"""
        당신은 사용자의 자연어 검색 요청을 MySQL SQL 쿼리로 변환하는 어시스턴트입니다.
        
        {schema_info}
        
        규칙:
        1. SELECT 문만 생성하세요 (SELECT, INSERT, UPDATE, DELETE 등 다른 명령은 사용하지 마세요)
        2. 반드시 is_sold = 0 조건을 포함하여 판매중인 상품만 조회하세요
        3. 최대 50개까지만 조회하도록 LIMIT 50을 추가하세요
        4. 최신순으로 정렬하세요 (ORDER BY created_at DESC)
        5. SQL만 반환하세요. 다른 설명이나 주석은 포함하지 마세요.
        6. 필요한 컬럼: PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold
        7. 질의에서 "검색해줘", "검색", "찾아줘" 같은 부가 문구는 무시하고 실제 검색 키워드만 추출하세요
        
        키워드 검색 규칙:
        - 카테고리 관련 일반 키워드만 단독으로 검색할 때는 해당 카테고리 필터만 사용하고, 키워드 LIKE 조건은 추가하지 마세요
          * 의류 카테고리 키워드: "신발", "옷", "의류", "가방"
          * 전자기기 카테고리 키워드: "노트북", "컴퓨터", "스마트폰", "전자기기", "태블릿"
          * 예: "신발 검색" → category = '의류'만, "노트북 검색" → category = '전자기기'만
        - 카테고리 키워드와 함께 다른 조건(가격, 브랜드명, 모델명 등)이 함께 검색될 때는 카테고리 필터 + 카테고리 키워드 LIKE 조건 + 다른 조건을 모두 추가하세요
          * 예: "65만원 이하 노트북" → category = '전자기기' AND price <= 650000 AND product_name LIKE '%노트북%'
          * 예: "나이키 신발" → category = '의류' AND product_name LIKE '%나이키%' AND product_name LIKE '%신발%'
        - 브랜드명(나이키, 컨버스, 아디다스, 푸마, 뉴발란스 등)이나 모델명(에어포스, 코르테즈, 척테일러 등)이 포함된 경우, 카테고리 '의류'를 자동으로 필터에 추가하고 브랜드/모델명 키워드는 OR 조건으로 검색하세요
        - 전자제품 브랜드/모델명(아이폰, 갤럭시, 맥북, 삼성 등)이 포함된 경우, 카테고리 '전자기기'를 자동으로 필터에 추가하고 키워드는 OR 조건으로 검색하세요
        
        예시:
        질의: "신발 검색"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '의류' ORDER BY created_at DESC LIMIT 50
        
        질의: "옷 검색"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '의류' ORDER BY created_at DESC LIMIT 50
        
        질의: "노트북 검색"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '전자기기' ORDER BY created_at DESC LIMIT 50
        
        질의: "컴퓨터 검색"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '전자기기' ORDER BY created_at DESC LIMIT 50
        
        질의: "겨울에 입을 만한 15만원 이하 옷 검색해줘"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '의류' AND price <= 150000 AND (product_name LIKE '%겨울%' OR description LIKE '%겨울%') ORDER BY created_at DESC LIMIT 50
        
        질의: "나이키 신발 검색"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '의류' AND (product_name LIKE '%나이키%' OR description LIKE '%나이키%') ORDER BY created_at DESC LIMIT 50
        
        질의: "나이키 에어포스 검색"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '의류' AND ((product_name LIKE '%나이키%' OR description LIKE '%나이키%') OR (product_name LIKE '%에어포스%' OR description LIKE '%에어포스%')) ORDER BY created_at DESC LIMIT 50
        
        질의: "아이폰 검색"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '전자기기' AND (product_name LIKE '%아이폰%' OR description LIKE '%아이폰%') ORDER BY created_at DESC LIMIT 50
        
        질의: "65만원 이하 노트북"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '전자기기' AND price <= 650000 AND product_name LIKE '%노트북%' ORDER BY created_at DESC LIMIT 50
        
        질의: "15만원 이하 신발"
        SQL: SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND category = '의류' AND price <= 150000 AND product_name LIKE '%신발%' ORDER BY created_at DESC LIMIT 50
        """
        
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"검색 요청: {nl_query.strip()}"}
            ],
            temperature=0.1,
            max_tokens=300
        )
        
        sql = completion.choices[0].message.content.strip()
        
        # SQL 코드 블록 제거 (마크다운 코드 블록이 있는 경우)
        if sql.startswith('```'):
            lines = sql.split('\n')
            sql = '\n'.join(lines[1:-1]) if lines[-1].startswith('```') else '\n'.join(lines[1:])
        
        return sql.strip()
        
    except Exception as e:
        print(f"LLM SQL 생성 오류: {e}")
        # 폴백: 기본 SQL 생성 (단순 LIKE 검색)
        # 보안을 위해 파라미터화는 나중에 추가 가능
        safe_query = nl_query.replace("'", "''")  # SQL Injection 방지 (기본)
        return f"SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, category, created_at, is_sold FROM PRODUCT WHERE is_sold = 0 AND (product_name LIKE '%{safe_query}%' OR description LIKE '%{safe_query}%') ORDER BY created_at DESC LIMIT 50"

def validate_sql(sql: str):
    """SQL의 기본적인 보안 검증"""
    sql_lower = sql.lower().strip()
    
    # SELECT만 허용
    if not sql_lower.startswith('select'):
        raise ValueError("SELECT 문만 허용됩니다.")
    
    # 위험한 키워드 검사 (단어 경계 고려 - 정규식 사용)
    import re
    dangerous_keywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate', 'exec', 'execute']
    for keyword in dangerous_keywords:
        # 단어 경계를 고려한 검색 (컬럼명에 포함된 경우 제외)
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, sql_lower):
            raise ValueError(f"위험한 키워드 '{keyword}'가 포함되어 있습니다.")
    
    # is_sold = 0 조건이 있는지 확인 (선택사항)
    if 'is_sold' not in sql_lower:
        # 없으면 추가
        if 'where' in sql_lower:
            sql = sql.replace('WHERE', 'WHERE is_sold = 0 AND', 1)
        else:
            # ORDER BY나 LIMIT 전에 WHERE 추가
            if 'order by' in sql_lower:
                sql = sql.replace('ORDER BY', 'WHERE is_sold = 0 ORDER BY', 1)
            elif 'limit' in sql_lower:
                sql = sql.replace('LIMIT', 'WHERE is_sold = 0 LIMIT', 1)
            else:
                sql += ' WHERE is_sold = 0'
    
    # LIMIT 추가 (없으면)
    if 'limit' not in sql_lower:
        sql += ' LIMIT 50'
    
    return sql

@app.route('/api/search/nl', methods=['GET'])
def search_natural_language():
    """자연어 질의를 LLM으로 SQL로 변환하여 검색한다."""
    try:
        q = request.args.get('q', '').strip()
        if not q:
            return jsonify({'error': '검색어를 입력해주세요.'}), 400

        # 로그 출력 (요청 시작)
        print("[NL-SEARCH] user_query:", q)

        # LLM으로 SQL 생성
        try:
            sql = generate_sql_with_llm(q)
            print("[NL-SEARCH] raw_sql_from_llm:", sql)
        except Exception as e:
            print(f"[NL-SEARCH] LLM SQL 생성 오류: {e}")
            return jsonify({'error': f'SQL 생성 중 오류가 발생했습니다: {str(e)}'}), 500
        
        # SQL 검증
        try:
            sql = validate_sql(sql)
            print("[NL-SEARCH] validated_sql:", sql)
        except ValueError as e:
            print(f"[NL-SEARCH] SQL 검증 실패: {e}")
            print(f"[NL-SEARCH] 검증 실패한 SQL: {sql}")
            return jsonify({'error': f'SQL 검증 오류: {str(e)}', 'sql': sql}), 400

        # 데이터베이스 연결 및 실행
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        try:
            cursor = conn.cursor()
            cursor.execute(sql)
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
            print(f"[NL-SEARCH] 검색 결과: {len(rows)}개 상품")
        except Exception as e:
            print(f"[NL-SEARCH] SQL 실행 오류: {e}")
            print(f"[NL-SEARCH] 실행 실패한 SQL: {sql}")
            if conn:
                conn.close()
            return jsonify({'error': f'SQL 실행 중 오류가 발생했습니다: {str(e)}', 'sql': sql}), 500

        # 결과 변환
        products = []
        for r in rows:
            image_url = None
            if r[4]:  # image_url (LONGBLOB)
                image_base64 = base64.b64encode(r[4]).decode('utf-8')
                image_url = f"data:image/jpeg;base64,{image_base64}"
            products.append({
                'id': r[0],
                'title': r[1] or '상품명 없음',
                'price': r[2] or 0,
                'description': r[3] or '',
                'image_url': image_url,
                'delivery_method': r[5] or '배송 정보 없음',
                'category': r[6] or '기타',
                'created_at': r[7].isoformat() if r[7] else None,
                'is_sold': bool(r[8])
            })

        return jsonify({
            'products': products,
            'total': len(products),
            'sql': sql  # 디버깅용으로 SQL도 반환
        }), 200
        
    except Exception as e:
        print(f"[NL-SEARCH] 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'자연어 검색 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/upload-image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['image']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        # 1. 고유한 파일명 생성 (이전과 동일)
        extension = file.filename.split('.')[-1]
        unique_filename = f"{uuid.uuid4()}.{extension}"

        try:
            # 2. S3에 파일 업로드
            s3_client.upload_fileobj(
                file,  # 업로드할 파일 객체
                S3_BUCKET_NAME,  # 버킷 이름
                unique_filename,  # S3에 저장될 파일 이름
                ExtraArgs={
                    'ContentType': file.content_type  # 브라우저가 파일을 올바르게 해석하도록 MIME 타입 지정
                }
            )

            # 3. 업로드된 파일의 S3 URL 생성
            image_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{unique_filename}"

            # 4. JSON 형태로 S3 URL 반환
            return jsonify({'imageUrl': image_url})

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'File upload failed'}), 500

# 글 업로드 로직 만들어야 함


###################################################################################
# 챗봇 관련 라우트
###################################################################################

@app.route('/chatbot')
def chatbot_page():
    """챗봇 페이지 렌더링"""
    return render_template('chatbot.html')

@app.route('/chat/<int:room_id>')
def chat_page(room_id):
    """채팅 페이지 렌더링"""
    return render_template('chat.html')

@app.route('/api/chatbot', methods=['POST'])
def chatbot_api():
    """챗봇 API - 사용자 메시지 처리"""
    try:
        data = request.get_json()
        message = data.get('message', '').strip()
        
        if not message:
            return jsonify({'error': '메시지가 비어있습니다.'}), 400
        
        # 챗봇 인스턴스 가져오기
        chatbot = get_chatbot()
        if not chatbot:
            return jsonify({'error': '챗봇이 초기화되지 않았습니다.'}), 500
        
        # 세션 ID 생성 (사용자별로 구분)
        session_id = session.get('user_id', 'anonymous')
        
        # 챗봇 응답 생성
        response = chatbot.chat(message, session_id)
        
        return jsonify({
            'response': response,
            'success': True
        }), 200
        
    except Exception as e:
        print(f"챗봇 API 오류: {e}")
        return jsonify({'error': '챗봇 응답 생성 중 오류가 발생했습니다.'}), 500

@app.route('/api/chatbot/clear', methods=['POST'])
def clear_chatbot_session():
    """챗봇 세션 초기화"""
    try:
        chatbot = get_chatbot()
        if chatbot:
            session_id = session.get('user_id', 'anonymous')
            chatbot.clear_session(session_id)
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        print(f"챗봇 세션 초기화 오류: {e}")
        return jsonify({'error': '세션 초기화 중 오류가 발생했습니다.'}), 500

# 챗봇 초기화 (앱 시작 시)
def init_chatbot():
    """챗봇 초기화"""
    try:
        # OpenAI API 키 확인
        openai_api_key = os.getenv('open_api_key')
        if not openai_api_key:
            print("경고: OPENAI_API_KEY가 설정되지 않았습니다. 챗봇이 작동하지 않을 수 있습니다.")
            return False
        
        # 챗봇 초기화
        initialize_chatbot(
            api_key=openai_api_key,
            pdf_path="potato_market_guide.pdf",  # PDF 파일 경로
            persist_directory="vector_db"  # 벡터 DB 저장 경로
        )
        
        print("챗봇이 성공적으로 초기화되었습니다.")
        return True
        
    except Exception as e:
        print(f"챗봇 초기화 오류: {e}")
        return False

# 채팅 관련 API
@app.route('/api/chat/rooms', methods=['GET'])
def get_chat_rooms():
    """사용자의 채팅방 목록 조회 (페이징)"""
    try:
        if 'user_id' not in session:
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        user_id = session['user_id']
        page = int(request.args.get('page', 1))
        per_page = 10
        offset = (page - 1) * per_page
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # 전체 채팅방 개수 조회
        cursor.execute("""
            SELECT COUNT(*) as total
            FROM CHAT_ROOM
            WHERE SELLER_ID = %s OR BUYER_ID = %s
        """, (user_id, user_id))
        total = cursor.fetchone()['total']
        
        # 채팅방 목록 조회 (최신 메시지 기준 정렬)
        cursor.execute("""
            SELECT 
                cr.ROOM_ID,
                cr.PRODUCT_ID,
                cr.SELLER_ID,
                cr.BUYER_ID,
                cr.created_at,
                cr.updated_at,
                p.product_name,
                p.price,
                p.image_url,
                CASE 
                    WHEN cr.SELLER_ID = %s THEN u_buyer.nickname
                    ELSE u_seller.nickname
                END as other_user_nickname,
                CASE 
                    WHEN cr.SELLER_ID = %s THEN u_buyer.USER_ID
                    ELSE u_seller.USER_ID
                END as other_user_id,
                (SELECT message FROM CHAT_MESSAGE 
                 WHERE ROOM_ID = cr.ROOM_ID 
                 ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM CHAT_MESSAGE 
                 WHERE ROOM_ID = cr.ROOM_ID 
                 ORDER BY created_at DESC LIMIT 1) as last_message_time,
                (SELECT COUNT(*) FROM CHAT_MESSAGE 
                 WHERE ROOM_ID = cr.ROOM_ID 
                 AND SENDER_ID != %s 
                 AND is_read = 0) as unread_count
            FROM CHAT_ROOM cr
            INNER JOIN PRODUCT p ON cr.PRODUCT_ID = p.PRODUCT_ID
            INNER JOIN USER u_seller ON cr.SELLER_ID = u_seller.USER_ID
            INNER JOIN USER u_buyer ON cr.BUYER_ID = u_buyer.USER_ID
            WHERE cr.SELLER_ID = %s OR cr.BUYER_ID = %s
            ORDER BY cr.updated_at DESC
            LIMIT %s OFFSET %s
        """, (user_id, user_id, user_id, user_id, user_id, per_page, offset))
        
        rooms = cursor.fetchall()
        
        # 이미지 URL 처리
        for room in rooms:
            if room['image_url']:
                if isinstance(room['image_url'], bytes):
                    room['image_url'] = base64.b64encode(room['image_url']).decode('utf-8')
                    room['image_url'] = f"data:image/jpeg;base64,{room['image_url']}"
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'rooms': rooms,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }), 200
        
    except Exception as e:
        print(f"채팅방 목록 조회 오류: {e}")
        return jsonify({'error': '채팅방 목록을 불러오는 중 오류가 발생했습니다.'}), 500

@app.route('/api/chat/room', methods=['POST'])
def create_or_get_chat_room():
    """채팅방 생성 또는 조회"""
    try:
        if 'user_id' not in session:
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        data = request.get_json()
        product_id = data.get('product_id')
        
        if not product_id:
            return jsonify({'error': '상품 ID가 필요합니다.'}), 400
        
        buyer_id = session['user_id']
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # 상품 정보 조회
        cursor.execute("""
            SELECT PRODUCT_ID, SELLER_ID, product_name, price
            FROM PRODUCT
            WHERE PRODUCT_ID = %s
        """, (product_id,))
        product = cursor.fetchone()
        
        if not product:
            cursor.close()
            conn.close()
            return jsonify({'error': '상품을 찾을 수 없습니다.'}), 404
        
        seller_id = product['SELLER_ID']
        
        if buyer_id == seller_id:
            cursor.close()
            conn.close()
            return jsonify({'error': '자신의 상품에는 채팅할 수 없습니다.'}), 400
        
        # 기존 채팅방 확인
        cursor.execute("""
            SELECT ROOM_ID
            FROM CHAT_ROOM
            WHERE PRODUCT_ID = %s AND SELLER_ID = %s AND BUYER_ID = %s
        """, (product_id, seller_id, buyer_id))
        existing_room = cursor.fetchone()
        
        if existing_room:
            room_id = existing_room['ROOM_ID']
        else:
            # 새 채팅방 생성
            cursor.execute("""
                INSERT INTO CHAT_ROOM (PRODUCT_ID, SELLER_ID, BUYER_ID)
                VALUES (%s, %s, %s)
            """, (product_id, seller_id, buyer_id))
            conn.commit()
            room_id = cursor.lastrowid
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'room_id': room_id,
            'product': {
                'id': product['PRODUCT_ID'],
                'name': product['product_name'],
                'price': product['price']
            }
        }), 200
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        print(f"채팅방 생성/조회 오류: {error_msg}")
        # 에러 메시지를 클라이언트에도 전달 (디버깅용)
        return jsonify({'error': f'채팅방을 생성하는 중 오류가 발생했습니다: {error_msg}'}), 500

@app.route('/api/chat/room/<int:room_id>/messages', methods=['GET'])
def get_chat_messages(room_id):
    """채팅방 메시지 조회"""
    try:
        if 'user_id' not in session:
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        user_id = session['user_id']
        
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # 채팅방 접근 권한 확인
        cursor.execute("""
            SELECT ROOM_ID, PRODUCT_ID, SELLER_ID, BUYER_ID
            FROM CHAT_ROOM
            WHERE ROOM_ID = %s AND (SELLER_ID = %s OR BUYER_ID = %s)
        """, (room_id, user_id, user_id))
        room = cursor.fetchone()
        
        if not room:
            cursor.close()
            conn.close()
            return jsonify({'error': '채팅방에 접근할 수 없습니다.'}), 403
        
        # 상품 정보 조회
        cursor.execute("""
            SELECT PRODUCT_ID, product_name, price, SELLER_ID
            FROM PRODUCT
            WHERE PRODUCT_ID = %s
        """, (room['PRODUCT_ID'],))
        product = cursor.fetchone()
        
        # 상대방 정보 조회
        other_user_id = room['SELLER_ID'] if room['BUYER_ID'] == user_id else room['BUYER_ID']
        cursor.execute("""
            SELECT USER_ID, nickname
            FROM USER
            WHERE USER_ID = %s
        """, (other_user_id,))
        other_user = cursor.fetchone()
        
        # 메시지 조회
        cursor.execute("""
            SELECT 
                MESSAGE_ID,
                ROOM_ID,
                SENDER_ID,
                message,
                is_read,
                created_at,
                (SELECT nickname FROM USER WHERE USER_ID = SENDER_ID) as sender_nickname
            FROM CHAT_MESSAGE
            WHERE ROOM_ID = %s
            ORDER BY created_at ASC
        """, (room_id,))
        messages = cursor.fetchall()
        
        # 읽지 않은 메시지 읽음 처리
        cursor.execute("""
            UPDATE CHAT_MESSAGE
            SET is_read = 1
            WHERE ROOM_ID = %s AND SENDER_ID != %s AND is_read = 0
        """, (room_id, user_id))
        conn.commit()
        
        # 메시지의 created_at을 문자열로 변환
        for msg in messages:
            if isinstance(msg['created_at'], datetime):
                msg['created_at'] = msg['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            else:
                msg['created_at'] = str(msg['created_at'])
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'room': {
                'room_id': room['ROOM_ID'],
                'product': product,
                'other_user': other_user
            },
            'messages': messages
        }), 200
        
    except Exception as e:
        print(f"메시지 조회 오류: {e}")
        return jsonify({'error': '메시지를 불러오는 중 오류가 발생했습니다.'}), 500

# Socket.IO 이벤트 핸들러
@socketio.on('connect')
def handle_connect():
    """클라이언트 연결 시"""
    print(f'클라이언트 연결: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    """클라이언트 연결 해제 시"""
    print(f'클라이언트 연결 해제: {request.sid}')

@socketio.on('join_room')
def handle_join_room(data):
    """채팅방 입장"""
    try:
        room_id = data.get('room_id')
        if room_id:
            join_room(str(room_id))
            print(f'사용자가 채팅방 {room_id}에 입장했습니다.')
    except Exception as e:
        print(f'채팅방 입장 오류: {e}')

@socketio.on('leave_room')
def handle_leave_room(data):
    """채팅방 퇴장"""
    try:
        room_id = data.get('room_id')
        if room_id:
            leave_room(str(room_id))
            print(f'사용자가 채팅방 {room_id}에서 퇴장했습니다.')
    except Exception as e:
        print(f'채팅방 퇴장 오류: {e}')

@socketio.on('send_message')
def handle_send_message(data):
    """메시지 전송"""
    try:
        room_id = data.get('room_id')
        message = data.get('message')
        sender_id = data.get('sender_id')
        
        if not all([room_id, message, sender_id]):
            emit('error', {'message': '필수 정보가 누락되었습니다.'})
            return
        
        conn = get_db_connection()
        if not conn:
            emit('error', {'message': '데이터베이스 연결 오류'})
            return
        
        cursor = conn.cursor(dictionary=True)
        
        # 채팅방 접근 권한 확인
        cursor.execute("""
            SELECT ROOM_ID, SELLER_ID, BUYER_ID
            FROM CHAT_ROOM
            WHERE ROOM_ID = %s AND (SELLER_ID = %s OR BUYER_ID = %s)
        """, (room_id, sender_id, sender_id))
        room = cursor.fetchone()
        
        if not room:
            cursor.close()
            conn.close()
            emit('error', {'message': '채팅방에 접근할 수 없습니다.'})
            return
        
        # 메시지 저장
        cursor.execute("""
            INSERT INTO CHAT_MESSAGE (ROOM_ID, SENDER_ID, message)
            VALUES (%s, %s, %s)
        """, (room_id, sender_id, message))
        
        # INSERT 직후 lastrowid 가져오기 (commit 전에)
        message_id = cursor.lastrowid
        
        # 채팅방 업데이트 시간 갱신
        cursor.execute("""
            UPDATE CHAT_ROOM
            SET updated_at = NOW()
            WHERE ROOM_ID = %s
        """, (room_id,))
        
        conn.commit()
        
        # 발신자 정보 조회
        cursor.execute("""
            SELECT nickname
            FROM USER
            WHERE USER_ID = %s
        """, (sender_id,))
        sender = cursor.fetchone()
        
        if not sender:
            cursor.close()
            conn.close()
            emit('error', {'message': '사용자 정보를 찾을 수 없습니다.'})
            return
        
        # 저장된 메시지 조회 (lastrowid가 없으면 최신 메시지 조회)
        if message_id:
            cursor.execute("""
                SELECT MESSAGE_ID, ROOM_ID, SENDER_ID, message, is_read, created_at
                FROM CHAT_MESSAGE
                WHERE MESSAGE_ID = %s
            """, (message_id,))
            saved_message = cursor.fetchone()
        else:
            # lastrowid가 없는 경우 최신 메시지 조회
            cursor.execute("""
                SELECT MESSAGE_ID, ROOM_ID, SENDER_ID, message, is_read, created_at
                FROM CHAT_MESSAGE
                WHERE ROOM_ID = %s AND SENDER_ID = %s
                ORDER BY MESSAGE_ID DESC
                LIMIT 1
            """, (room_id, sender_id))
            saved_message = cursor.fetchone()
        
        if not saved_message:
            cursor.close()
            conn.close()
            print(f'메시지 저장 실패: message_id={message_id}, room_id={room_id}, sender_id={sender_id}')
            emit('error', {'message': '메시지를 저장하는 중 오류가 발생했습니다.'})
            return
        
        cursor.close()
        conn.close()
        
        # 메시지 객체 구성
        # 시간을 문자열로 변환 (시간대 정보 없이)
        if isinstance(saved_message['created_at'], datetime):
            created_at_str = saved_message['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        else:
            created_at_str = str(saved_message['created_at'])
        
        message_data = {
            'MESSAGE_ID': saved_message['MESSAGE_ID'],
            'ROOM_ID': saved_message['ROOM_ID'],
            'SENDER_ID': saved_message['SENDER_ID'],
            'message': saved_message['message'],
            'is_read': saved_message['is_read'],
            'created_at': created_at_str,
            'sender_nickname': sender['nickname']
        }
        
        # 채팅방의 모든 사용자에게 메시지 전송
        emit('receive_message', message_data, room=str(room_id))
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        print(f'메시지 전송 오류: {error_msg}')
        emit('error', {'message': f'메시지 전송 중 오류가 발생했습니다: {error_msg}'})

###################################################################################
if __name__ == '__main__':
    # 챗봇 초기화
    init_chatbot()
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)