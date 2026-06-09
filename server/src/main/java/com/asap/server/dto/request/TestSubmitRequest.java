package com.asap.server.dto.request;

import com.asap.server.global.type.Language;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TestSubmitRequest {
  int from;
  int to;
  Language language;
  String sourceCode;
}
