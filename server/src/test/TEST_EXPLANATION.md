# 테스트 코드 설명

## 테스트 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| 테스트 프레임워크 | JUnit 5 (Jupiter) |
| 모킹 | Mockito (`@ExtendWith(MockitoExtension.class)`) |
| 단언(Assertions) | AssertJ (`assertThat(...)`) |
| 인메모리 DB | H2 (PostgreSQL 모드) |
| 리플렉션 | `ReflectionTestUtils.setField()` (private 필드 주입) |

---

## 전체 구조

```
src/test/
├── java/com/asap/server/
│   ├── ServerApplicationTests.java       # 스프링 컨텍스트 로딩 연기 테스트
│   ├── service/
│   │   ├── AuthServiceTest.java          # 인증/인가 서비스
│   │   ├── ProfileServiceTest.java       # 프로필 서비스
│   │   ├── ContestServiceTest.java       # 대회 서비스
│   │   ├── PaymentServiceTest.java       # 결제 서비스
│   │   └── TokenServiceTest.java         # JWT 토큰 서비스
│   └── controller/
│       ├── AuthControllerTest.java
│       ├── ParticipantControllerTest.java
│       ├── ContestControllerTest.java
│       ├── PaymentControllerTest.java
│       └── CodeControllerTest.java
└── resources/
    ├── application-test.properties       # 테스트 전용 설정
    └── schema-h2-test.sql                # 테스트 DB 스키마
```

---

## AuthServiceTest (16개)

### 로그인

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `login_success` | 로그인 성공 시 access + refresh 토큰이 모두 반환되는지 확인 |
| `login_userNotFound` | 없는 이메일로 로그인 시 예외 발생 |
| `login_wrongPassword` | 비밀번호 불일치 시 예외 발생 |

> **포인트:** `login_userNotFound`와 `login_wrongPassword`는 **같은 에러 메시지**("이메일 또는 비밀번호가 일치하지 않습니다")를 반환한다.
> 어느 쪽이 틀렸는지 알려주면 계정 존재 여부가 노출되는 **계정 열거 공격(Account Enumeration)** 에 취약해지기 때문이다.

### 회원가입

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `signup_emailAlreadyExists` | 중복 이메일 가입 차단 |
| `signup_newEmail_sendsMail` | 가입 즉시 DB 저장이 아니라 **이메일 인증 후 저장** 흐름 보장 |

> **포인트:** 회원가입은 `signup → verifySignupMail` 두 단계로 나뉜다.
> 이메일 인증 전까지 DB에 저장하지 않아 미인증 계정이 쌓이는 것을 방지하고, 실제 소유자만 가입 완료할 수 있도록 한다.

### 이메일 인증

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `verifySignupMail_noPending` | 회원가입 요청 없이 인증 코드만 보내는 비정상 흐름 차단 |
| `verifySignupMail_wrongCode` | 코드 불일치 시 가입 거부 |
| `verifySignupMail_success` | 코드 일치 시에만 `userRepository.save()` 호출됨을 보장 |
| `resendMail_noPending` | 미가입 이메일로 재발송 요청 차단 |
| `resendMail_success` | 재발송 성공 시 `mailService.sendVerificationCode()` 호출 확인 |

### 회원탈퇴

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `withdraw_success` | 비밀번호 확인 후 정상 삭제 |
| `withdraw_userNotFound` | 없는 유저 탈퇴 시도 차단 |
| `withdraw_wrongPassword` | 탈퇴 전 비밀번호 재확인 — 토큰 탈취 시 계정 삭제 방지 |

### 로그아웃 / SMS

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `logout_success` | 로그아웃 시 access 토큰 블랙리스트 + 세션 폐기 **둘 다** 실행되는지 확인 |
| `logoutAll_success` | 전체 기기 로그아웃이 실제로 모든 세션을 삭제하는지 확인 |
| `sendSMS_success` / `verifySMS_success` | SMS 로직이 SmsService에 **완전히 위임**됨을 확인 (AuthService에서 직접 처리하지 않음) |

---

## ProfileServiceTest (13개)

### 내 프로필 조회

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `getMyProfile_success` | 정상 조회 |
| `getMyProfile_userNotFound` | 없는 유저 조회 시 예외 |
| `getMyProfile_profileNull` | 유저는 있지만 프로필이 없는 엣지 케이스 별도 처리 |

### 프로필 수정

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `updateMyProfile_nicknameChanged` | 닉네임 변경 시 **새 태그를 자동 할당**하는 로직 작동 확인 |
| `updateMyProfile_sameNickname` | 같은 닉네임이면 태그 재할당 **안 하는지** 확인 (불필요한 태그 소모 방지) |
| `updateMyProfile_nullNickname` | null이면 기존 닉네임 유지 |
| `updateMyProfile_blankNickname` | 공백만 있어도 기존 닉네임 유지 |
| `updateMyProfile_tagExhausted` | 동일 닉네임 태그 9999개 소진 시 차단 |

> **포인트:** null과 공백 모두 별도 케이스로 두는 이유 — 실수로 닉네임을 지우는 상황을 방지하기 위해 두 입력 모두 기존값 유지로 처리한다.

### 타인 프로필 조회

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `getOtherProfile_success` | `닉네임-0001` 형식으로 정상 조회 |
| `getOtherProfile_noSeparator` | `-` 없는 형식(`testnick0001`) 입력 거부 |
| `getOtherProfile_tagNotFourDigits` | 3자리 태그(`testnick-123`) 거부 |
| `getOtherProfile_tagOutOfRange` | 태그 `0000` 거부 (유효 범위 0001~9999) |
| `getOtherProfile_notFound` | 해당 프로필 없으면 예외 |

---

## ContestServiceTest (23개)

### 비인증 대회 생성

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `createUncertifiedContest_success_testStatus` | TEST 상태 — 날짜 없이 생성 가능 |
| `createUncertifiedContest_success_plannedStatus` | PLANNED 상태 — 미래 날짜 포함 정상 생성 |
| `createUncertifiedContest_userNotFound` | 없는 유저로 생성 시도 차단 |
| `createUncertifiedContest_certificationMustBeFalse` | 비인증 API 경로인데 `certification=true` 전달 시 차단 |
| `createUncertifiedContest_missingRequiredCodes` | judgeCode/sampleCode/AI코드 없이는 대회 진행 불가 — 저장 전 검증 |
| `createUncertifiedContest_missingDatesForNonTestStatus` | TEST 외 상태는 날짜 필수 |
| `createUncertifiedContest_startNotBeforeEnd` | 시작일 ≥ 종료일인 대회 차단 |
| `createUncertifiedContest_plannedButStartInPast` | PLANNED인데 시작일이 과거이면 이미 불가능한 대회 |

### 인증 대회 생성

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `createCertifiedContest_success_testStatus` | 인증 대회 정상 생성 |
| `createCertifiedContest_certificationMustBeTrue` | 인증 API 경로인데 `certification=false` 전달 시 차단 |
| `createCertifiedContest_missingVisualizationHtml` | 인증 대회는 시각화 HTML 필수 — 없으면 화면 표시 불가 |
| `createCertifiedContest_missingExampleAiCodes` | AI 코드 없으면 대회 진행 불가 |

### 대회 참가

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `joinContest_success` | 정상 참가 |
| `joinContest_contestNotFound` | 없는 대회 참가 시도 차단 |
| `joinContest_alreadyJoined` | 중복 참가 차단 |
| `joinContest_maxParticipantsExceeded` | 정원 초과 참가 차단 |
| `joinContest_endedContest` | 종료된 대회 참가 차단 |
| `joinContest_canceledContest` | 취소된 대회 참가 차단 |

> **포인트:** END와 CANCELED를 별도 케이스로 두는 이유 — 같은 에러이지만 상태 분기 로직이 각각 트리거됨을 보장하기 위해서다.

### 참가 취소

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `cancelJoinContest_success` | 정상 취소 |
| `cancelJoinContest_userNotFound` | 없는 유저의 취소 요청 차단 |
| `cancelJoinContest_noParticipation` | 참가한 적 없는 대회 취소 시도 차단 |

### 기타

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `getContestPage_withStatus` | 상태 필터 있을 때 `findByStatusAndDeletedAtIsNull()` 쿼리 호출 확인 |
| `getContestPage_noStatus` | 상태 필터 없을 때 `findAllByDeletedAtIsNull()` 쿼리 호출 확인 |

---

## PaymentServiceTest (10개)

### 실결제 (Toss Payments API 연동)

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `confirmPayment_duplicateOrderId` | 같은 주문ID로 재요청 시 이중 결제 차단 |
| `confirmPayment_tossApi4xxError` | API 4xx → `IllegalArgumentException` (클라이언트 잘못, HTTP 400 변환) |
| `confirmPayment_tossApiNetworkError` | 네트워크 장애 → `IllegalStateException` (서버 문제, HTTP 500 변환) |
| `confirmPayment_tossApiError_deletesContest` | **결제 실패 + contestId 있음 → 대회도 함께 삭제** (고아 데이터 방지) |
| `confirmPayment_tossApiError_noContest_skipDelete` | **결제 실패 + contestId 없음 → 대회 삭제 로직 실행 안 함** |

> **포인트:** 결제 실패 시 연결된 대회를 삭제하는 이유 — 결제가 완료되지 않은 대회는 참가자를 받으면 안 되는 "고아 데이터"가 되기 때문에 결제와 대회를 원자적으로 처리한다.

### 테스트 결제 (API 호출 없음)

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `confirmPaymentForTest_success` | 실제 Toss API 없이 테스트 결제 흐름이 DB에 정상 저장되는지 확인 |
| `confirmPaymentForTest_duplicateOrderId` | 중복 주문 ID 차단 |
| `confirmPaymentForTest_userNotFound` | 없는 유저의 결제 요청 차단 |
| `confirmPaymentForTest_zeroAmount` | 0원 결제 차단 |
| `confirmPaymentForTest_negativeAmount` | 음수 결제 차단 — 악의적인 무료 결제 시도 방지 |

---

## TokenServiceTest (13개)

### 토큰 발급

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `issueAccessToken_success` | `JwtTokenProvider`에 올바른 인자를 전달하는지 확인 |
| `issueRefreshToken_success` | Redis 저장 + 토큰 발급이 **함께** 일어나는지 검증 (저장 없으면 이후 검증 불가) |

### 리프레시 토큰 검증

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `validateAndGetRefreshTokenMeta_invalidToken` | 만료/변조 토큰 즉시 차단 |
| `validateAndGetRefreshTokenMeta_wrongTokenType` | access 토큰으로 refresh 엔드포인트 악용 차단 — 허용 시 무제한 재발급 가능 |
| `validateAndGetRefreshTokenMeta_notInRedis` | 서버가 이미 폐기한(로그아웃된) 세션의 토큰 차단 |
| `validateAndGetRefreshTokenMeta_hashMismatch` | **토큰 탈취 감지** → 전체 세션 강제 만료 |
| `validateAndGetRefreshTokenMeta_success` | 정상 토큰 검증 성공 |

> **포인트:** 해시 불일치 시 전체 세션을 만료시키는 이유 — 해시 불일치는 토큰이 유출됐을 가능성을 의미한다. 어떤 세션에서 유출됐는지 특정할 수 없으므로 해당 유저의 모든 세션을 만료시켜 공격자를 즉시 차단한다.

### 액세스 토큰 블랙리스트

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `blacklistAccessToken_invalidToken` | 이미 만료된 토큰 블랙리스트 등록 시도 — **무시해도 안전**함을 확인 |
| `blacklistAccessToken_refreshType` | refresh 토큰은 별도 경로 관리 — access 블랙리스트에 섞이면 안 됨 |
| `blacklistAccessToken_success` | JTI 기반으로 Redis에 저장되는지 확인 |
| `isAccessTokenBlacklisted_true` | 블랙리스트에 있는 토큰 감지 |
| `isAccessTokenBlacklisted_false` | 정상 토큰은 블랙리스트에 없음 확인 |

> **포인트:** true/false 두 케이스를 모두 테스트하는 이유 — `false`만 검증하면 항상 `false`를 반환하는 버그를 잡지 못하고, `true`만 검증하면 정상 요청이 차단되는 버그를 잡지 못한다.

### 세션 폐기

| 테스트 | 왜 필요한가 |
|--------|-----------|
| `revokeAllUserSessions_withSessions` | 세션이 있을 때 정상 삭제 |
| `revokeAllUserSessions_noSessions` | 세션이 없는 상태에서 로그아웃해도 NPE 없이 처리 |
| `revokeSession_success` | 특정 세션 키와 세션 목록에서 **둘 다** 삭제되는지 확인 |

---

## 예외 설계 규칙

| 예외 타입 | 사용 상황 | HTTP 변환 |
|----------|---------|----------|
| `IllegalArgumentException` | 입력 유효성, 비즈니스 규칙 위반 | 400 |
| `IllegalStateException` | 잘못된 상태 전이, 리소스 고갈, 토큰 탈취 감지 | 500 |
| `HttpClientErrorException` | 외부 API 4xx 오류 | 400 |
| `RuntimeException` | 네트워크/시스템 오류 | 500 |

---

## 자주 받을 수 있는 질문 Q&A

**Q. 로그인 실패 시 "이메일이 없습니다" / "비밀번호가 틀렸습니다"로 구분하지 않는 이유는?**
> 어느 쪽이 틀렸는지 알려주면 계정 존재 여부가 노출되어 계정 열거 공격(Account Enumeration)에 취약해지기 때문이다.

**Q. 회원가입을 두 단계(signup → verifySignupMail)로 나눈 이유는?**
> 이메일 인증 전까지 DB에 저장하지 않아 미인증 계정이 쌓이는 것을 방지하고, 실제 이메일 소유자만 가입 완료할 수 있도록 보장한다.

**Q. 결제 실패 시 왜 대회까지 삭제하나요?**
> 결제가 완료되지 않은 대회는 참가자를 받으면 안 되는 고아 데이터가 된다. 결제와 대회 생성을 원자적으로 처리해 데이터 정합성을 보장한다.

**Q. 토큰 해시 불일치 시 왜 해당 세션만 아니라 전체 세션을 만료시키나요?**
> 해시 불일치는 토큰이 탈취된 후 재사용된다는 신호다. 어떤 세션에서 유출됐는지 특정할 수 없으므로 해당 유저의 모든 세션을 만료시켜 공격자를 즉시 차단한다.

**Q. END 상태와 CANCELED 상태를 왜 별도 테스트 케이스로 나눴나요?**
> 같은 에러 메시지를 반환하더라도, 두 상태가 각각 독립적으로 해당 분기를 트리거하는지 확인해야 하기 때문이다. 하나만 테스트하면 다른 상태에서 분기가 누락됐을 때 잡지 못한다.

**Q. 0원/음수 결제를 별도로 테스트하는 이유는?**
> 악의적인 사용자가 0원이나 음수 금액으로 무료 결제를 시도하는 상황을 방지하기 위해서다.
