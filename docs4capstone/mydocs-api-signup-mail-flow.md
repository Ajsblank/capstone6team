# 회원가입-이메일인증 API 협업 문서

## 목표 흐름

[회원가입 버튼 클릭]
-> POST /api/auth/signup
-> 회원 정보 저장 + 인증번호 자동 발송(백엔드)
-> [팝업에서 코드 입력]
-> POST /api/auth/mail
-> [완료 화면]

## Base URL

- 로컬: http://localhost:8080
- 같은 와이파이 외부 기기: http://172.21.103.148:8080

## 1) 회원가입 + 인증번호 자동 발송

- Method: POST
- Path: /api/auth/signup
- Content-Type: application/json

Request Body:
```json
{
  "email": "user@example.com",
  "nickname": "my_nickname",
  "password": "my_password"
}
```

Success Response:
- Status: 201
- Body:
```text
회원가입이 완료되었습니다. 인증번호를 확인해주세요.
```

Error Response (예시):
- Status: 400
- Body:
```text
이미 가입된 이메일입니다.
```

## 2) 팝업 인증번호 검증

- Method: POST
- Path: /api/auth/mail
- Content-Type: application/json

Request Body:
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

Success Response:
- Status: 200
- Body:
```text
이메일 인증이 완료되었습니다.
```

Error Response (예시):
- Status: 400
- Body:
```text
가입되지 않은 이메일입니다.
```

또는

- Status: 400
- Body:
```text
인증번호가 일치하지 않습니다.
```

## 프론트 연동 포인트

- 회원가입 API 성공(201) 직후 인증번호 입력 팝업 표시
- 팝업 확인 버튼에서 /api/auth/mail 호출
- /api/auth/mail 성공(200) 시 완료 화면 이동
- 실패(400) 시 메시지 표시 후 팝업 유지

## curl 테스트

1) 회원가입
```bash
curl -X POST "http://localhost:8080/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","nickname":"my_nickname","password":"my_password"}'
```

2) 이메일 인증
```bash
curl -X POST "http://localhost:8080/api/auth/mail" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","code":"123456"}'
```
