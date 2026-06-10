#!/bin/bash
BLUE_PORT=8080
GREEN_PORT=8081
APP_DIR=/home/ubuntu/app
SERVICE_URL_INC=/etc/nginx/conf.d/service-url.inc
ECR_IMAGE=$1  # 인자로 이미지 URI 받음

# 환경변수 로드
set -a
source $APP_DIR/.env
set +a

# 현재 서비스 포트 확인
CURRENT_PORT=$(grep -oP '(?<=:)\d+' $SERVICE_URL_INC)
if [ "$CURRENT_PORT" == "$BLUE_PORT" ]; then
    IDLE_PORT=$GREEN_PORT
    IDLE_CONTAINER="green"
    ACTIVE_PORT=$BLUE_PORT
    ACTIVE_CONTAINER="blue"
else
    IDLE_PORT=$BLUE_PORT
    IDLE_CONTAINER="blue"
    ACTIVE_PORT=$GREEN_PORT
    ACTIVE_CONTAINER="green"
fi

echo "▶ 현재 서비스 포트: $ACTIVE_PORT"
echo "▶ 새 버전 실행 포트: $IDLE_PORT"

# ECR 로그인
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_REGISTRY

# 이미지 pull
docker pull $ECR_IMAGE

# 새 컨테이너 실행
docker stop $IDLE_CONTAINER 2>/dev/null || true
docker rm $IDLE_CONTAINER 2>/dev/null || true
docker run -d \
    --name $IDLE_CONTAINER \
    --network host \
    --env-file $APP_DIR/.env \
    -e SERVER_PORT=$IDLE_PORT \
    $ECR_IMAGE

# Health check
echo "▶ Health check 시작..."
for i in {1..10}; do
    sleep 10
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$IDLE_PORT/actuator/health)
    if [ "$RESPONSE" == "200" ] || [ "$RESPONSE" == "302" ] || [ "$RESPONSE" == "401" ] || [ "$RESPONSE" == "403" ] || [ "$RESPONSE" == "404" ]; then
        echo "✅ Health check 성공"
        break
    fi
    echo "⏳ 대기 중... ($i/10)"
    if [ "$i" == "10" ]; then
        echo "❌ Health check 실패 — 롤백"
        docker stop $IDLE_CONTAINER
        docker rm $IDLE_CONTAINER
        exit 1
    fi
done

# Nginx 전환
echo "▶ Nginx 전환: $ACTIVE_PORT → $IDLE_PORT"
echo "set \$service_url http://127.0.0.1:$IDLE_PORT;" | sudo tee $SERVICE_URL_INC
sudo nginx -s reload

# 기존 컨테이너 종료
echo "▶ 기존 컨테이너 $ACTIVE_CONTAINER 종료"
docker stop $ACTIVE_CONTAINER 2>/dev/null || true
docker rm $ACTIVE_CONTAINER 2>/dev/null || true

echo "🎉 배포 완료 — 현재 서비스 포트: $IDLE_PORT"
