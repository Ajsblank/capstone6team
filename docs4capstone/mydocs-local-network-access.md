# API 통신 가이드 (프론트 없이 테스트)

프론트엔드 없이 서버 API만 테스트/연동할 때 필요한 정보 정리.

## 1. 기본 주소

- 같은 PC에서 테스트: `http://localhost:8080`
- 같은 와이파이의 다른 기기에서 테스트: `http://172.21.103.148:8080`

예시:

```bash
BASE_URL=http://localhost:8080
```

## 2. 인증/보안 규칙

- 인증 없이 호출 가능:
  - `/api/auth/**`
- 그 외 API는 JWT 필요 (`Authorization: Bearer <accessToken>`)

## 3. API 명세

### 3-1. 이메일 인증번호 검증

- Method/Path: `POST /api/auth/mail`
- Body(JSON):

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

- 성공(200):

```text
이메일 인증이 완료되었습니다.
```

- 실패(400):

```text
인증번호가 일치하지 않습니다.
```

### 3-2. 회원가입

- Method/Path: `POST /api/auth/signup`
- Body(JSON):

```json
{
  "email": "user@example.com",
  "nickname": "my_nickname",
  "password": "my_password"
}
```

- 성공(201):

```text
회원가입이 완료되었습니다. 인증번호를 확인해주세요.
```

- 주요 실패 케이스:
  - 중복 이메일: `이미 가입된 이메일입니다.`

### 3-3. 로그인

- Method/Path: `POST /api/auth/login`
- Body(JSON):

```json
{
  "email": "user@example.com",
  "password": "my_password"
}
```

- 성공(200):

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

### 3-4. 코드 제출 (JWT 필요)

- Method/Path: `POST /api/code/submit`
- Header:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

- Body(JSON):

```json
{
  "userId": "1",
  "language": "cpp",
  "sourceCode": "#include <iostream>\nint main(){return 0;}"
}
```

- 성공(200):

```json
{
  "success": true,
  "message": "코드가 서버에 성공적으로 제출되었습니다!"
}
```

## 4. curl 테스트 예시

### 4-1. 회원가입

```bash
curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","nickname":"my_nickname","password":"my_password"}'
```

### 4-2. 인증번호 검증

```bash
curl -X POST "$BASE_URL/api/auth/mail" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","code":"123456"}'
```

### 4-3. 로그인

```bash
curl -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"my_password"}'
```

### 4-4. 코드 제출

```bash
ACCESS_TOKEN=<로그인_응답_accessToken>

curl -X POST "$BASE_URL/api/code/submit" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"1","language":"cpp","sourceCode":"#include <iostream>\\nint main(){return 0;}"}'
```

## 5. 같은 와이파이 외부 기기 테스트 시 체크사항

- 서버는 `server.address=0.0.0.0` 으로 실행
- Windows 포트포워딩/방화벽(8080) 열림 상태 확인
- WSL2 IP 변경 시 `portproxy` 재설정
