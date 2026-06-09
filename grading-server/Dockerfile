# Stage 1: Build C++ server
FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# CMakeLists.txt만 먼저 복사 → deps 레이어 캐시
# CMakeLists.txt가 바뀌지 않으면 hiredis/redis++/json 재빌드 안 함
COPY CMakeLists.txt ./
RUN echo "int main(){}" > grading-server.cpp \
    && cmake -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --parallel $(nproc)

# 실제 소스 복사 → touch로 타임스탬프 갱신 후 재컴파일
COPY grading-server.cpp ./
RUN touch grading-server.cpp && cmake --build build --parallel $(nproc)

# Stage 2: Runtime image (Docker CLI for DooD)
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /src/build/server /usr/local/bin/server

# /tmp/grading must match the host bind-mount path so that
# inner "docker run -v /tmp/grading/<id>:/app" resolves correctly
# on the host Docker daemon (DooD).
WORKDIR /tmp/grading

ENV REDIS_HOST=""

ENTRYPOINT ["server"]
