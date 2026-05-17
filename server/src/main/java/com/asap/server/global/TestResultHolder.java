package com.asap.server.global;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

@Component
public class TestResultHolder {
  private final Map<Long, CompletableFuture<String>> futures = new ConcurrentHashMap<>();

  public CompletableFuture<String> register(Long contestId) {
    CompletableFuture<String> future = new CompletableFuture<>();
    futures.put(contestId, future);
    return future;
  }

  public void complete(Long contestId, String log) {
    CompletableFuture<String> future = futures.remove(contestId);
    if (future != null)
      future.complete(log);
  }
}