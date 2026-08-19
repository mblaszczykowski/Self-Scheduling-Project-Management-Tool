package com.backend.entities;

public enum TaskPriority {
    LOWEST(1),
    LOW(3),
    MEDIUM(5),
    HIGH(8),
    HIGHEST(10);

    private final int weight;

    TaskPriority(int weight) {
        this.weight = weight;
    }

    public int getWeight() {
        return weight;
    }
}
