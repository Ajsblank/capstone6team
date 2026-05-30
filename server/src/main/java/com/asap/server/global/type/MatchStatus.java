package com.asap.server.global.type;

import java.util.Locale;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum MatchStatus {
  READY, RUNNING, FINISHED, CANCELED;

  @JsonCreator
  public static MatchStatus from(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("matchStatus 값이 비어 있습니다. 허용값: READY, RUNNING, FINISHED, CANCELED");
    }

    String normalized = value.trim().toUpperCase(Locale.ROOT);

    try {
      return MatchStatus.valueOf(normalized);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException(
          "지원하지 않는 matchStatus 입니다: " + value + " (허용값: READY, RUNNING, FINISHED, CANCELED)");
    }
  }
}