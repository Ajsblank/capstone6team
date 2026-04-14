cmake_minimum_required(VERSION 3.14)
project(GradingServer)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

include(ExternalProject)
include(FetchContent)

# 라이브러리를 현재 프로젝트 폴더 내부에 설치하도록 경로 지정
set(DEPS_INSTALL_DIR ${CMAKE_BINARY_DIR}/local_deps)

# Hiredis 자동 다운로드 및 내부 빌드
ExternalProject_Add(hiredis_ext
    GIT_REPOSITORY https://github.com/redis/hiredis.git
    GIT_TAG master
    PREFIX ${CMAKE_BINARY_DIR}/hiredis
    CMAKE_ARGS 
        -DCMAKE_INSTALL_PREFIX=${DEPS_INSTALL_DIR}
        -DBUILD_SHARED_LIBS=OFF
)

# redis-plus-plus 자동 다운로드 및 내부 빌드
ExternalProject_Add(redis_pp_ext
    GIT_REPOSITORY https://github.com/sewenew/redis-plus-plus.git
    GIT_TAG master
    DEPENDS hiredis_ext
    PREFIX ${CMAKE_BINARY_DIR}/redis-plus-plus
    CMAKE_ARGS 
        -DCMAKE_INSTALL_PREFIX=${DEPS_INSTALL_DIR}
        -DCMAKE_PREFIX_PATH=${DEPS_INSTALL_DIR}
        -DREDIS_PLUS_PLUS_BUILD_SHARED=OFF
        -DREDIS_PLUS_PLUS_BUILD_STATIC=ON
)

FetchContent_Declare(json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(json)

# 채점 서버 실행 파일 생성
add_executable(server grading-server.cpp)

add_dependencies(server redis_pp_ext)
target_include_directories(server PRIVATE ${DEPS_INSTALL_DIR}/include)
target_link_directories(server PRIVATE ${DEPS_INSTALL_DIR}/lib ${DEPS_INSTALL_DIR}/lib64)
target_link_libraries(server PRIVATE 
    ${DEPS_INSTALL_DIR}/lib/libredis++.a 
    ${DEPS_INSTALL_DIR}/lib/libhiredis.a 
    pthread 
    nlohmann_json::nlohmann_json
)