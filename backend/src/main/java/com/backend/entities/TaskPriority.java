package com.backend.entities;

public enum TaskPriority {
    LOWEST(1, "Lowest"),
    LOW(2, "Low"),
    MEDIUM(3, "Medium"),
    HIGH(4, "High"),
    HIGHEST(5, "Highest");

    private final int weight;
    private final String displayName;

    TaskPriority(int weight, String displayName) {
        this.weight = weight;
        this.displayName = displayName;
    }

    public int getWeight() {
        return weight;
    }

    public String getDisplayName() {
        return displayName;
    }
}