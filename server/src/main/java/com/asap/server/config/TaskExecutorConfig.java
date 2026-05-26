package com.asap.server.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class TaskExecutorConfig {
  @Bean
  public TaskExecutor workerTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);
    executor.setMaxPoolSize(4);
    executor.setThreadNamePrefix("redis-worker-");
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.setAwaitTerminationSeconds(10);
    executor.setThreadFactory(r -> {
      Thread t = new Thread(r);
      t.setDaemon(true);
      t.setPriority(Thread.NORM_PRIORITY - 1); // API보다 낮은 우선순위
      t.setName("redis-worker-" + t.threadId());
      return t;
    });
    executor.initialize();
    return executor;
  }
}