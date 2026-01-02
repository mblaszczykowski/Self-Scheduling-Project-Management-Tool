package com.backend.entities;

public enum TaskStatus {
    BACKLOG("Backlog"),
    GATHERING_INTEREST("Gathering Interest"),
    TODO("To Do"),
    WITHDRAWN("Withdrawn"),
    IN_PROGRESS("In Progress"),
    TO_REVIEW("To Review"),
    TO_TEST("To Test"),
    IN_TEST("In Test"),
    READY_TO_MERGE("Ready to Merge"),
    READY_TO_DEPLOY("Ready to Deploy"),
    RELEASED("Released"),
    DONE("Done");

    private final String displayName;

    TaskStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}