package com.backend.entities;

public enum TaskPriority {
    LOWEST(1),
    LOW(3),
    MEDIUM(5),
    HIGH(8),
    HIGHEST(10);

    /**
     * The scheduling weight w_j on a 1..10 scale, as defined by the MORCPSP model.
     *
     * <p>Single source of truth: this used to be a separate 1..5 scale that nothing read, while
     * the scheduler kept its own contradictory 1/3/5/8/10 mapping — so anyone reaching for
     * {@code getWeight()} would silently have got the wrong weights.
     */
    private final int weight;

    TaskPriority(int weight) {
        this.weight = weight;
    }

    public int getWeight() {
        return weight;
    }
}
