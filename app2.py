from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import mysql.connector
from datetime import datetime
import hashlib
import os
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

app = Flask(__name__)
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

# API 라우트들

# 회원가입 API
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # 필수 필드 검증
        required_fields = ['email', 'password']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field}은(는) 필수입니다.'}), 400
        
        # 비밀번호 확인
        if data['password'] != data.get('confirmPassword'):
            return jsonify({'error': '비밀번호가 일치하지 않습니다.'}), 400
        
        # 이메일 중복 확인
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT USER_ID FROM USER WHERE email = %s", (data['email'],))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': '이미 존재하는 이메일입니다.'}), 400
        
        # 사용자 등록
        processed_password = process_password(data['password'])
        cursor.execute("""
            INSERT INTO USER (email, password, created_at)
            VALUES (%s, %s, %s)
        """, (data['email'], processed_password, datetime.now()))
        
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
            SELECT USER_ID, email, created_at FROM USER 
            WHERE email = %s AND password = %s
        """, (data['email'], processed_password))
        
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user:
            return jsonify({
                'message': '로그인 성공',
                'user': {
                    'id': user[0],
                    'email': user[1],
                    'created_at': user[2].isoformat() if user[2] else None
                }
            }), 200
        else:
            return jsonify({'error': '이메일 또는 비밀번호가 올바르지 않습니다.'}), 401
            
    except Exception as e:
        return jsonify({'error': f'로그인 중 오류가 발생했습니다: {str(e)}'}), 500

# 상품 목록 API
@app.route('/api/products', methods=['GET'])
def get_products():
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': '데이터베이스 연결 오류'}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT PRODUCT_ID, product_name, price, description, created_at, SELLER_ID
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
            product_list.append({
                'id': product[0],
                'title': product[1],
                'price': product[2],
                'description': product[3],
                'created_at': product[4].isoformat() if product[4] else None,
                'seller_id': product[5]
            })
        
        return jsonify({'products': product_list}), 200
        
    except Exception as e:
        return jsonify({'error': f'상품 목록 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 상품 등록 API (추후 구현)
@app.route('/api/products', methods=['POST'])
def create_product():
    return jsonify({'message': '상품 등록 기능은 추후 구현될 예정입니다.'}), 501

# 마이페이지 API (추후 구현)
@app.route('/api/user/profile', methods=['GET'])
def get_user_profile():
    return jsonify({'message': '마이페이지 기능은 추후 구현될 예정입니다.'}), 501

# 게시판 API (추후 구현)
@app.route('/api/board', methods=['GET'])
def get_board_posts():
    return jsonify({'message': '게시판 기능은 추후 구현될 예정입니다.'}), 501

###################################################################################
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
