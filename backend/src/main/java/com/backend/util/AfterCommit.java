package com.backend.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Defers a side effect until the current transaction has committed.
 *
 * <p>For anything that is not transactional and cannot be undone: unlinking a file, pushing an
 * event to an open stream, sending mail. Doing that work inline means a later rollback leaves the
 * database and the outside world disagreeing — most visibly, deleting a project used to unlink
 * every attachment of every task and comment and <em>then</em> fail to delete the rows, leaving the
 * project intact with every attachment URL pointing at a missing file.
 *
 * <p>Failures are swallowed and logged on purpose. Spring propagates an exception thrown from an
 * {@code afterCommit} callback to the caller of {@code commit()}, which would turn an
 * already-committed write into a 500 and invite the user to retry and create a duplicate.
 */
public final class AfterCommit {

    private static final Logger log = LoggerFactory.getLogger(AfterCommit.class);

    private AfterCommit() {}

    /** Runs after commit, or immediately if no transaction is active. */
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
