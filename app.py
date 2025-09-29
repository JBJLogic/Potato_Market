from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
import mysql.connector
from datetime import datetime
import hashlib
import os
import base64
from dotenv import load_dotenv

# AWS 관리 라이브러리. boto3 라이브러리를 사용해서 aws s3에 이미지 업로드 해야 함.
import boto3

# 환경 변수 로드
load_dotenv()

app = Flask(__name__)
app.secret_key = 'potato_market_secret_key_2024'  # 세션을 위한 시크릿 키
CORS(app)  # CORS 설정으로 프론트엔드와의 통신 허용

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
    return render_template('product_detail.html')

# API 라우트들

# 회원가입 API
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # 필수 필드 검증
        required_fields = ['email', 'password', 'nickname']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field}은(는) 필수입니다.'}), 400
        
        # 비밀번호 확인
        if data['password'] != data.get('confirmPassword'):
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
        
        # 사용자 등록
        processed_password = process_password(data['password'])
        cursor.execute("""
            INSERT INTO USER (email, nickname, password, money, created_at)
            VALUES (%s, %s, %s, %s, %s)
        """, (data['email'], data['nickname'], processed_password, 0, datetime.now()))
        
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
        
        cursor.execute("""
            SELECT USER_ID, email, nickname, money, created_at FROM USER 
            WHERE email = %s AND password = %s
        """, (data['email'], processed_password))
        
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user:
            # 세션에 사용자 정보 저장
            session['user_id'] = user[0]
            session['user_email'] = user[1]
            session['user_nickname'] = user[2]
            session['user_money'] = user[3]
            session['logged_in'] = True
            
            return jsonify({
                'message': '로그인 성공',
                'user': {
                    'id': user[0],
                    'email': user[1],
                    'nickname': user[2],
                    'money': user[3],
                    'created_at': user[4].isoformat() if user[4] else None
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
                    'money': session.get('user_money')
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
            SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, created_at, SELLER_ID
            FROM PRODUCT 
            WHERE is_sold = 0
            ORDER BY created_at DESC 
            LIMIT 20
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
                'title': product[1],
                'price': product[2],
                'description': product[3],
                'image_url': image_url,
                'delivery_method': product[5],
                'created_at': product[6].isoformat() if product[6] else None,
                'seller_id': product[7]
            })
        
        return jsonify({'products': product_list}), 200
        
    except Exception as e:
        return jsonify({'error': f'상품 목록 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 상품 상세 정보 API
@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product_detail(product_id):
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT PRODUCT_ID, product_name, price, description, image_url, delivery_method, created_at, SELLER_ID
            FROM PRODUCT 
            WHERE PRODUCT_ID = %s AND is_sold = 0
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
            'seller_nickname': seller_nickname
        }
        
        return jsonify({'product': product_detail}), 200
        
    except Exception as e:
        return jsonify({'error': f'상품 상세 조회 중 오류가 발생했습니다: {str(e)}'}), 500

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
        
        if 'image' not in request.files or not request.files['image'].filename:
            return jsonify({'error': '상품 이미지를 선택해주세요.'}), 400
        
        if 'seller_id' not in request.form or not request.form['seller_id']:
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
        # 데이터 추출
        title = request.form['title']
        price = int(request.form['price'])
        delivery = request.form['delivery']
        description = request.form['description']
        seller_id = int(request.form['seller_id'])
        image_file = request.files['image']
        
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
            INSERT INTO PRODUCT (SELLER_ID, product_name, price, description, image_url, delivery_method, created_at, is_sold)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (seller_id, title, price, description, image_data, delivery, datetime.now(), 0))
        
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


# 마이페이지 API (추후 구현)
@app.route('/api/user/profile', methods=['GET'])
def get_user_profile():
    return jsonify({'message': '마이페이지 기능은 추후 구현될 예정입니다.'}), 501

# 게시판 API (추후 구현)
@app.route('/api/board', methods=['GET'])
def get_board_posts():
    return jsonify({'message': '게시판 기능은 추후 구현될 예정입니다.'}), 501

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
        
        # 사용자 ID 확인 (실제로는 세션에서 가져와야 함)
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        
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

###################################################################################
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)