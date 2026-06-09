package com.asap.server.global.type;

import java.util.Locale;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum ResultType {
  WIN, DRAW, PENDING, BYE, WIN1, WIN2;

  @JsonCreator
  public static ResultType from(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("resultType 값이 비어 있습니다. 허용값: WIN, DRAW, PENDING, BYE");
    }

    String normalized = value.trim().toUpperCase(Locale.ROOT);

    try {
      return ResultType.valueOf(normalized);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException("지원하지 않는 resultType 입니다: " + value + " (허용값: WIN, DRAW, PENDING, BYE)");
    }
  }
}