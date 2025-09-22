## 구성
웹서버 nginx

WSGI gunicorn

웹 프레임워크 Flask


## 진행 사항
gunicorn nginx 연결 완료


## 알아둬야 할 점

80포트로 받은 요청은 nginx에서 gunicorn으로 전달, gunicorn은 요청을 5000번 포트(flask)로 전달

응답은 알아서 잘 처리해주기 때문에 따로 세팅할 필요 없음(외부에서 요청 신호만 잘 전달되도록 세팅하면 됨. 이미 세팅 했기때문에 건들 부분 없음)

혹시 응답하는 부분에서 오류 발생하면 연락 바람

크롬에서 접속시 80포트로 접속하도록 설정됨

systemctl start pmarket은 gunicorn과 app.py를 같이 실행해줌


gunicorn pmarket서비스 세팅 파일 경로

/etc/systemd/system/pmarket.service


nginx 서버 설정 파일 경로

/etc/nginx/sites-available/pmarket


## 서버 실행 방법

```bash
sudo systemctl start pmarket

sudo systemctl start nginx
```







