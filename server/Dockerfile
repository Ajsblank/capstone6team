FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring
WORKDIR /app
COPY --chown=spring:spring build/libs/app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]