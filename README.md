# ASAP — 게임 AI 개발을 통한 알고리즘 대결 플랫폼

> **Tactical Code Battle (TCB)**: 직접 작성한 AI 코드로 다른 참가자의 코드와 맞붙는 실시간 코딩 배틀 플랫폼

---

## 팀원

| 이름 | 학과 | 이메일 | 역할 |
|------|------|--------|------|
| 박서윤 | 소프트웨어학과 | seopark428@ajou.ac.kr | Frontend |
| 안주성 | 소프트웨어학과 | ajs8780@ajou.ac.kr | Backend |
| 이재혁 | 소프트웨어학과 | asdfqwer1234@ajou.ac.kr | Backend |

---

## 프로젝트 개요

ASAP은 참가자가 게임 규칙에 맞는 AI 코드를 제출하면, 서버가 자동으로 코드를 채점하고 토너먼트를 진행하는 알고리즘 대결 플랫폼입니다.

- 참가자는 주어진 게임 명세를 읽고 C++ / Java / Python 으로 AI 코드를 작성해 제출합니다.
- 채점 서버가 Docker 샌드박스 안에서 참가자 코드와 예시 AI 코드를 실제로 실행하고 승패를 결정합니다.
- 대회는 **전체 리그(Full League)** 와 **스위스 리그(Swiss Tournament)** 두 가지 방식으로 진행됩니다.
- 누구나 새로운 게임을 설계해 대회를 개최할 수 있으며, 인증 대회는 리뷰어 검토 후 게시됩니다.

---

## 주요 기능

### 대회 참가자
- 대회 목록 조회 및 참가 신청
- 코드 에디터(Monaco Editor)에서 C++ / Java / Python 코드 작성 후 제출
- 제출 즉시 예시 AI와의 매치 결과 확인 (SSE 실시간 알림)
- 자신의 제출 이력 조회 및 최종 제출 코드 수동 선택
- 실시간 리더보드 / 스위스 토너먼트 대진표 확인

### 대회 개최자
- 게임 명세 작성 (Rich Text Editor), 채점 코드, 예시 AI 코드, 시각화 HTML 업로드
- **일반 대회**: 즉시 개설 (Toss Payments 결제 후 생성)
- **인증 대회**: 리뷰어 이메일 지정 → 검토 승인 후 게시
- 대회 상태 관리 (PLANNED → RUNNING → END), 참가자 현황 조회

### 인증 / 계정
- 이메일 인증 코드 방식 회원가입
- 휴대폰 SMS 인증 (Solapi)
- JWT 액세스 토큰 + 리프레시 토큰 (Redis 저장)

---

## 기술 스택

### Frontend
| 분류 | 기술 |
|------|------|
| Framework | React 19, TypeScript 4.9 |
| 코드 에디터 | Monaco Editor (`@monaco-editor/react`) |
| Rich Text | Tiptap |
| HTTP | Axios |
| 결제 | Toss Payments SDK |
| 실시간 | SSE (Server-Sent Events) |
| 빌드 | Create React App |

### Backend
| 분류 | 기술 |
|------|------|
| Framework | Spring Boot 4.0, Java 21 |
| ORM | Spring Data JPA, Hibernate |
| 인증 | Spring Security, JWT (`jjwt 0.12`) |
| 이메일 | Spring Mail (Gmail SMTP) |
| SMS | Solapi SDK |
| 스토리지 | AWS S3 (제출 코드, 채점 코드 저장) |
| 실시간 | SSE (SseEmitter) |
| 캐싱/큐 | Redis (채점 큐, 인증 코드, 리프레시 토큰) |
| API 문서 | SpringDoc OpenAPI (Swagger UI `/swagger-ui.html`) |

### Grading Server (채점 서버)
| 분류 | 기술 |
|------|------|
| 언어 | C++ (CMake 빌드) |
| 채점 방식 | Docker-out-of-Docker (DooD) — 참가자 코드를 `code-battle-env` 이미지 내에서 실행 |
| 채점 큐 | Redis (`code_battle_grading_queue`, `code_battle_swiss_league_queue`, `code_battle_full_league_queue`, `code_battle_test_queue`) |
| 결과 큐 | Redis (`code_battle_ai_result_queue`, `code_battle_swiss_league_result_queue`, `code_battle_full_league_result_queue`, `code_battle_test_result_queue`) |
| 지원 언어 | C++ / Java / Python / C |

### 인프라
| 분류 | 기술 |
|------|------|
| 클라우드 | AWS (EC2, S3, ECR, SSM, Auto Scaling Group, RDS) |
| 프론트 배포 | S3 Static Hosting + CloudFront |
| 백엔드 배포 | EC2 — Nginx blue-green, `deploy.sh`를 SSM으로 원격 실행 |
| 채점 서버 배포 | ECR Docker 이미지 → EC2 ASG (`asap-judge-server`) |
| DB | PostgreSQL 16 (AWS RDS) |
| 리버스 프록시 | Nginx (EC2 내 blue-green 트래픽 전환) |
| CI/CD | GitHub Actions |

---

## 디렉토리 구조

```
root/
├── front/                          # React 프론트엔드
│   ├── src/
│   │   ├── api/                    # Axios API 함수 (auth, contest, code, payment, SSE)
│   │   ├── components/             # 재사용 UI 컴포넌트
│   │   ├── pages/                  # 페이지 컴포넌트 (라우팅은 App.tsx 내 switch)
│   │   ├── context/AppContext.tsx  # 전역 상태 (유저, 현재 페이지)
│   │   ├── utils/                  # 유틸리티 함수 (약관 로딩 등)
│   │   └── types/index.ts          # 공통 TypeScript 타입
│   └── public/
│       ├── chito_battle_log.html   # 대전 로그 시각화 (게임별 커스텀 HTML)
│       └── chito_battle_self.html  # 솔로 플레이 HTML
│
├── server/                         # Spring Boot 백엔드
│   └── src/main/java/com/asap/server/
│       ├── controller/             # REST API 엔드포인트
│       ├── service/                # 비즈니스 로직 (대회 실행, 스위스 리그, 결제 등)
│       ├── domain/                 # JPA 엔티티
│       ├── repository/             # Spring Data JPA 리포지토리
│       ├── config/                 # Security, JWT, Redis, S3, CORS 설정
│       ├── dto/                    # Request / Response DTO
│       └── global/                 # 공통 예외 처리, 타입 Enum
│
├── grading-server/                 # C++ 채점 서버
│   ├── grading-server.cpp          # Redis 큐를 폴링하며 Docker 내에서 채점 실행
│   ├── CMakeLists.txt
│   └── Dockerfile                  # 멀티스테이지 빌드 (Builder + DooD Runtime)
│
├── db/
│   ├── schema.sql                  # 전체 DB 스키마 (스테이징 기준 최신)
│   └── docker-compose.yml          # 로컬 PostgreSQL 16 + Redis 7
│
├── example/                        # 예제 게임 (대회 개최 양식 참고용)
│   ├── competition_example/        # 캐릭터 카드 배틀 (메인 게임 예시)
│   ├── chain_reaction/             # 연쇄 폭발 게임
│   ├── dots_and_boxes/             # 점과 상자 게임
│   ├── flood_fill_war/             # 영역 확장 전쟁
│   ├── apple_game/                 # 사과 게임
│   └── yut/                        # 윷놀이
│
└── docs4capstone/                  # 캡스톤 제출 문서
    ├── 00MANIFEST.md               # 문서 인덱스
    └── 06.ASAP_proposal.pdf        # 기획 제안서
```

---

## 핵심 아키텍처

### 채점 흐름

```
[참가자 코드 제출]
       │
       ▼
[Spring Boot API]
  ① S3에 코드 업로드
  ② Redis 채점 큐에 JSON 페이로드 push
       │
       ▼
[Grading Server (C++)]
  ③ Redis 큐를 폴링 (BRPOP)
  ④ /tmp/grading/<id>/ 디렉토리 생성
  ⑤ Docker-out-of-Docker로 judge / player1 / player2 컴파일
  ⑥ judge 프로세스 실행 → 승패 로그 수집
  ⑦ Redis에 결과 저장
       │
       ▼
[Spring Boot RedisResultWorker]
  ⑧ 결과 DB 반영
  ⑨ SSE로 프론트엔드에 실시간 알림
```

### 대회 진행 방식

- **Full League**: 모든 참가자가 서로 1:1 대결 — 정확한 평가를 위한 최종 집계용
- **Swiss Tournament**: 라운드별 점수 기반 대진 배정, 다중 라운드 진행
  - 대회 시작 시각에 `ContestRunService`가 자동으로 매칭을 생성하고 채점 큐에 등록
  - 서버 재시작 시 미처리 대회를 복구하는 로직 포함 (`@EventListener(ApplicationReadyEvent.class)`)

### 페이지 라우팅

프론트엔드는 SPA로 React Router 대신 `AppContext`의 `currentPage` 상태로 페이지를 전환합니다.

| 페이지 key | 설명 |
|------------|------|
| `landing` | 메인 랜딩 페이지 |
| `login` / `signup` | 로그인 / 회원가입 |
| `battle` | 대회 목록 홈 |
| `submit` | 코드 제출 페이지 (Monaco Editor) |
| `create-contest` | 일반 대회 개설 |
| `create-certified-contest` | 인증 대회 개설 |
| `contest-settings` | 대회 관리 (개최자) |
| `tournament` | 스위스 토너먼트 대진표 |
| `tutorial-contest` | 튜토리얼 대회 개설 |
| `profile` | 프로필 페이지 |
| `guestRegister` | 소프트콘 간편 회원가입 |
| `auto-login` | 소프트콘 자동 로그인 |

---

## 로컬 개발 환경 설정

### 사전 요구사항
- Java 21, Gradle
- Node.js 18+
- Docker & Docker Compose
- (채점 서버) CMake, g++, redis-plus-plus, nlohmann/json

### 1. DB 및 Redis 실행

```bash
cd db
docker-compose up -d
```

PostgreSQL은 `localhost:5432`, Redis는 `localhost:6379`에 바인딩됩니다.  
초기 스키마는 `schema.sql`이 자동으로 적용됩니다.

### 2. 백엔드 실행

```bash
cd server
# 환경 변수 설정 (또는 .env_server 참고)
export DB_URL=localhost
export DB_NAME=code_battle_db
export DB_USER=asap
export DB_PASSWORD=ascrrqbwk
export JWT_TOKEN=<your-jwt-secret>
export GMAIL_PASSWORD=<your-gmail-app-password>
# ... (SMS, S3 키는 선택)

./gradlew bootRun
```

서버는 `http://localhost:8080` 에서 실행됩니다.  
Swagger UI: `http://localhost:8080/swagger-ui.html`

### 3. 프론트엔드 실행

```bash
cd front
npm install
# .env.local 생성
echo "REACT_APP_API_BASE_URL=http://localhost:8080" > .env.local
npm start
```

앱은 `http://localhost:3000` 에서 실행됩니다.

### 4. 채점 서버 실행 (선택)

```bash
cd grading-server
cmake -B build
make -C build
REDIS_HOST=localhost ./build/server
```

Docker로 실행할 수도 있습니다:

```bash
cd grading-server

# 이미지 빌드
docker build --network=host -t grading-server .

# 실행
docker run -d \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /tmp/grading:/tmp/grading \
  -e REDIS_HOST=localhost \
  grading-server
```

---

## 배포 (GitHub Actions CI/CD)

| 워크플로우 | 트리거 | 대상 |
|------------|--------|------|
| `cd-main.yml` | `main` 브랜치 push | 프론트 → S3, 백엔드 → EC2 (SSM) |
| `cd-front.yml` | `develop` 브랜치 push | 프론트 → S3 (테스트 버킷) |
| `cd-server.yml` | `develop` 브랜치 push | 백엔드 → EC2 (SSM) |
| `deploy-grading-server.yml` | `dev/grading-server` 브랜치 push | 채점 서버 → ECR → EC2 ASG |
| `ci-front.yml` / `ci-server.yml` | PR | 빌드 & 테스트 |

### 필요한 GitHub Secrets

| Secret | 설명 |
|--------|------|
| `EC2_URL_TEST` | 백엔드 API 주소 |
| `ARN_ROLE` | AWS OIDC 역할 ARN |
| `DB_URL`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | DB 접속 정보 |
| `JWT_TOKEN` | JWT 서명 시크릿 |
| `GMAIL_PASSWORD` | Gmail 앱 비밀번호 |
| `SOL_API_KEY`, `SOL_API_SECRET`, `SOL_SENDER_NUMBER` | Solapi SMS 설정 |
| `GRADING_AWS_ACCESS_KEY_ID`, `GRADING_AWS_SECRET_ACCESS_KEY` | 채점 서버 ECR 배포용 |
| `ECR_REPOSITORY`, `ASG_NAME`, `REDIS_HOST` | 채점 서버 배포 설정 |

### GitHub Variables

| Variable | 설명 |
|----------|------|
| `AWS_REGION` | AWS 리전 (예: `us-east-1`) |
| `EC2_ID_INSTANCE_TEST` | 백엔드 EC2 인스턴스 ID |

---

## 예제 게임

`example/` 디렉토리에 대회 개최 시 참고할 수 있는 게임 예제가 포함되어 있습니다.

각 게임 디렉토리는 아래 파일로 구성됩니다.

| 파일 | 설명 |
|------|------|
| `judge.cpp` | 채점 코드 (플레이어 프로세스를 fork하여 게임 진행) |
| `sample_code.cpp` | 참가자 코드 예시 |
| `대회명세.md` | 게임 규칙 및 입출력 명세 |
| `log_visualization.html` | 게임 로그 시각화 HTML |
| `soloPlay.html` | 솔로 플레이 HTML |

### 채점 코드 규약

judge 프로그램은 `./judge <player1_executable> <player2_executable>` 형태로 호출됩니다.

- 게임 시작 시 각 플레이어 프로세스에 `READY FIRST` / `READY SECOND` 를 보내고 `OK` 응답을 기다립니다.
- 매 턴마다 `TIME <내 남은 시간> <상대 남은 시간>` 을 전달하고 플레이어의 행동을 읽습니다.
- 게임 종료 후 `WIN LOSE` 또는 `LOSE WIN` 또는 `DRAW DRAW` 형태로 stdout에 출력합니다.
- 채점 서버는 이 출력값을 파싱해 승패를 결정합니다.

---

## DB 스키마 요약

주요 테이블 및 관계는 다음과 같습니다.

```
users
 └─ code_battle_contest (creator_id → users.id)
     ├─ code_battle_example_ai        (대회별 예시 AI 코드, 난이도 순서)
     ├─ code_battle_sample_code       (참고용 샘플 코드)
     ├─ code_battle_participant        (참가자, 최종 제출 코드 선택 상태)
     │    └─ code_battle_submission   (제출 이력, S3 코드 URL)
     ├─ code_battle_match             (1:1 매치 결과, 게임 로그)
     ├─ contest_swiss_session         (스위스 토너먼트 세션)
     │    └─ contest_swiss_round      (라운드)
     │         └─ contest_swiss_match (라운드별 매치)
     ├─ contest_reviewer              (인증 대회 리뷰어)
     └─ payment                       (결제 이력, Toss Payments)
```

DB 스키마 파일은 `server/src/main/resources/db/migration/` 에 위치합니다 (현재 Flyway 비활성화, `schema.sql` / `schema_local_develop.sql` 로 직접 관리).

---

## 라이선스

본 프로젝트는 아주대학교 캡스톤 디자인 과제로 개발되었습니다.
