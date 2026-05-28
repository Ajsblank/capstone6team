package com.asap.server.dto.response;

import com.asap.server.global.type.Language;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SampleCodeResponse {
  private String code;
  private Language language;
}
