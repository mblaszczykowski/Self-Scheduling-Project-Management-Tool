# Stage 1: Build
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src
# Reuse downloaded artifacts without resolving unused optional database/plugin BOMs.
# CI runs the full test suite before building this image.
RUN --mount=type=cache,target=/root/.m2 mvn package -Dmaven.test.skip=true -B

# Stage 2: Run
FROM eclipse-temurin:21-jre

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --no-create-home app

COPY --from=build /app/target/*.jar app.jar

RUN mkdir -p /app/uploads && chown -R app:app /app

USER app

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
