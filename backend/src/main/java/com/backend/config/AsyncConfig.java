package com.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.Arrays;
import java.util.concurrent.ThreadPoolExecutor;

@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    private static final Logger log = LoggerFactory.getLogger(AsyncConfig.class);

    @Bean(name = "emailExecutor")
    public TaskExecutor emailExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("email-");
        // The default AbortPolicy throws TaskRejectedException on the *calling* thread. Since
        // notification emails are dispatched from an after-commit hook, that turned a full queue
        // into a 500 on a request whose data had already been saved. Running the task inline is
        // slower under load but never loses mail and never fails the caller's request.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        // Let in-flight mail finish on shutdown instead of dropping the queue on every deploy.
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        executor.initialize();
        return executor;
    }

    /**
     * Without this, an exception from any {@code void @Async} method is swallowed silently.
     */
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (throwable, method, params) ->
                log.error("Uncaught exception in @Async {}.{}({})",
                        method.getDeclaringClass().getSimpleName(), method.getName(),
                        Arrays.toString(params), throwable);
    }
}
