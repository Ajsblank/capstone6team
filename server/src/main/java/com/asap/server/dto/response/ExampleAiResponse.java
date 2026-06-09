package com.asap.server.dto.response;

import com.asap.server.global.type.Language;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ExampleAiResponse {
  private String code;
  private String description;
  private Language language;
}
