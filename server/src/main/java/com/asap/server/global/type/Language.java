package com.asap.server.global.type;

import java.util.Locale;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum Language {
  CPP, JAVA, PYTHON, C;

  @JsonCreator
  public static Language from(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("language 값이 비어 있습니다. 허용값: CPP, JAVA, PYTHON, C");
    }

    String normalized = value.trim().toUpperCase(Locale.ROOT)
        .replace("-", "_");

    switch (normalized) {
      case "0": return CPP;
      case "1": return JAVA;
      case "2": return PYTHON;
      case "3": return C;
    }

    if ("C++".equalsIgnoreCase(value) || "CPP".equals(normalized)) {
      return CPP;
    }
    if ("PY".equals(normalized) || "PY3".equals(normalized) || "PYTHON3".equals(normalized)
        || "PYTHON".equals(normalized)) {
      return PYTHON;
    }

    try {
      return Language.valueOf(normalized);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException("지원하지 않는 language 입니다: " + value + " (허용값: CPP, JAVA, PYTHON, C)");
    }
  }
}
