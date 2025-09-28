## 중고 거래 웹사이트 접속 주소

- http://13.125.20.217:5000 <br>

## 주의사항!
**깃 퍼블릭 저장소**이기 때문에 ec2주소, RDS엔드포인트, 각종 계정 id 비번 노출되지 않도록 **.env 파일에 따로 작성**해야 함

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

### 웹 서비스 시작 방법

```bash
# 프로젝트 폴더에서
source venv/bin/activate # 가상환경 활성
sudo systemctl start pmarket # gunicorn 실행 -> gunicorn이 app.py을 불러서 실행 + 프로젝트 폴더에 pmarket.sock 파일 생성됨
sudo systemctl start nginx # 웹 서버 실행(gunicorn을 먼저 실행해서 sock파일이 생성된 후에 실행 해야함)
```

### VPC
가상 네트워크 퍼블릭/프라이빗 서브넷을 만들고 목적에 맞게 인스턴스에 ip주소 할당

예를 들어 외부에서 접근하면 안되는 rds같은 경우 프라이빗 서브넷에 만들고

외부에서 접근 가능해야 하는 웹 서버(ec2)는 퍼블릭 서브넷에 만들어서 관리해야 함

퍼블릭 서브넷에 포함된 웹 서버는 외부에서 접근 가능한 퍼블릭 ip주소를 할당받고 vpc내부에서 사용 가능한 프라이빗 ip주소(10.0.x.x)를 할당받음. 프라이빗 서브넷에 포함된 rds는 프라이빗 ip주소만 할당받음


### AWS S3
이미지 파일이나 동영상 파일 같이 DB에 올리기 무거운 파일은 저장하는 저장소로 사용

DB에는 이미지 저장소 주소(URL형식)로 저장해서 클라이언트에게 이미지를 전달하면 됨

boto3 라이브러리를 통해 s3에 접근하는 방식 사용

### RDS
##### 워크밴치에서 접속 방법
SSH구성에서 ec2(웹 서버) 등록. key는 ec2 ssh접속할때 사용하는 key 사용

호스트명: rds엔드포인트

유저명: DB 유저명

비번: DB 비번

DB주소 예시 RDS엔드포인트@DB유저명

##### 주의사항
RDS는 외부에서 접근 불가능하기 때문에 클라이언트에서 직접 접근하지 않도록 코드 작성해야함.







