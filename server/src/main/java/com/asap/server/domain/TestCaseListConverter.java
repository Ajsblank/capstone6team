package com.asap.server.domain;

import java.util.Collections;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class TestCaseListConverter implements AttributeConverter<List<AlgorithmProblem.TestCase>, String> {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Override
  public String convertToDatabaseColumn(List<AlgorithmProblem.TestCase> attribute) {
    if (attribute == null) {
      return null;
    }
    try {
      return OBJECT_MAPPER.writeValueAsString(attribute);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Failed to serialize test cases", e);
    }
  }

  @Override
  public List<AlgorithmProblem.TestCase> convertToEntityAttribute(String dbData) {
    if (dbData == null || dbData.isBlank()) {
      return Collections.emptyList();
    }
    try {
      return OBJECT_MAPPER.readValue(dbData, new TypeReference<List<AlgorithmProblem.TestCase>>() {
      });
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Failed to deserialize test cases", e);
    }
  }
}
