package com.backend.entities;

public enum TaskPriority {
    LOWEST(1, "Lowest"),
    LOW(3, "Low"),
    MEDIUM(5, "Medium"),
    HIGH(8, "High"),
    HIGHEST(10, "Highest");

    /**
     * The scheduling weight w_j on a 1..10 scale, as defined by the MORCPSP model.
     *
     * <p>Single source of truth: this used to be a separate 1..5 scale that nothing read, while
     * the scheduler kept its own contradictory 1/3/5/8/10 mapping — so anyone reaching for
     * {@code getWeight()} would silently have got the wrong weights.
     */
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
