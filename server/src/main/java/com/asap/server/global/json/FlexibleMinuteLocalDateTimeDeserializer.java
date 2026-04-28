package com.asap.server.global.json;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

public class FlexibleMinuteLocalDateTimeDeserializer extends JsonDeserializer<LocalDateTime> {

  private static final DateTimeFormatter SPACE_MINUTE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
  private static final DateTimeFormatter SPACE_SECOND = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
  private static final DateTimeFormatter ISO_MINUTE = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");
  private static final DateTimeFormatter ISO_SECOND = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

  @Override
  public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
    String raw = parser.getValueAsString();
    if (raw == null) {
      return null;
    }

    String value = raw.trim();
    if (value.isEmpty()) {
      return null;
    }

    try {
      return LocalDateTime.parse(value, SPACE_MINUTE).withSecond(0).withNano(0);
    } catch (DateTimeParseException ignored) {
    }

    try {
      return LocalDateTime.parse(value, SPACE_SECOND).withSecond(0).withNano(0);
    } catch (DateTimeParseException ignored) {
    }

    try {
      return LocalDateTime.parse(value, ISO_MINUTE).withSecond(0).withNano(0);
    } catch (DateTimeParseException ignored) {
    }

    try {
      return LocalDateTime.parse(value, ISO_SECOND).withSecond(0).withNano(0);
    } catch (DateTimeParseException ignored) {
    }

    try {
      return LocalDateTime.parse(value).withSecond(0).withNano(0);
    } catch (DateTimeParseException ignored) {
    }

    throw context.weirdStringException(value, LocalDateTime.class,
        "지원하지 않는 날짜 형식입니다. yyyy-MM-dd HH:mm 형식을 사용해주세요.");
  }
}