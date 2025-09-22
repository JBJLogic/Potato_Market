## 구성
웹서버 nginx
WSGI gunicorn
웹 프레임워크 Flask

## 진행 사항
gunicorn nginx 연결 완료

## 알아둬야 할 점

80포트로 받은 요청은 nginx에서 gunicorn으로 전달 gunicorn은 요청을 5000번 포트(flask)로 전달
응답 할 경우 알아서 잘 처리해주기 때문에 따로 세팅할 필요 없음

크롬에서 접속시 80포트로 접속하도록 설정됨
