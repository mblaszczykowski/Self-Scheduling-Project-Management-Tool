package com.backend.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

public final class AfterCommit {
    private static final Logger log = LoggerFactory.getLogger(AfterCommit.class);

    private AfterCommit() {}

    public static void run(String description, Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            guarded(description, action);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                guarded(description, action);
            }
        });
    }

    private static void guarded(String description, Runnable action) {
        try {
            action.run();
        } catch (Exception e) {
            log.warn("Post-commit action failed ({}): {}", description, e.getMessage(), e);
        }
    }
}
