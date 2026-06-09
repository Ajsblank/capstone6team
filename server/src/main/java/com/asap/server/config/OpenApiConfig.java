package com.asap.server.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

@Configuration
public class OpenApiConfig {

  @Bean
  public OpenAPI openAPI() {
    String jwtSchemeName = "jwtAuth";
    // API 요청 시 해당 보안 설정을 사용하겠다는 선언
    SecurityRequirement securityRequirement = new SecurityRequirement().addList(jwtSchemeName);

    // SecurityScheme 설정 (Bearer JWT 방식)
    Components components = new Components()
        .addSecuritySchemes(jwtSchemeName, new SecurityScheme()
            .name(jwtSchemeName)
            .type(SecurityScheme.Type.HTTP) // HTTP 방식
            .scheme("bearer")
            .bearerFormat("JWT")); // 스웨거 UI에 "JWT"라고 표시됨

    return new OpenAPI()
        .addSecurityItem(securityRequirement)
        .components(components);
  }
}
