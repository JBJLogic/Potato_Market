from flask import Flask

# AWS 관리 라이브러리. boto3 라이브러리를 사용해서 aws s3에 이미지 업로드 해야 함.
import boto3


app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!'

if __name__ == '__main__':
    app.run(debug=True)