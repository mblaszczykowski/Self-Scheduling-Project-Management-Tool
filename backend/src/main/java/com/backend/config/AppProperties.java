package com.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Pagination pagination = new Pagination();
    private Sse sse = new Sse();
    private Optimization optimization = new Optimization();

    public Pagination getPagination() { return pagination; }
    public void setPagination(Pagination pagination) { this.pagination = pagination; }
    public Sse getSse() { return sse; }
    public void setSse(Sse sse) { this.sse = sse; }
    public Optimization getOptimization() { return optimization; }
    public void setOptimization(Optimization optimization) { this.optimization = optimization; }

    public static class Pagination {
        private int defaultSize = 50;
        private int maxSize = 100;

        public int getDefaultSize() { return defaultSize; }
        public void setDefaultSize(int defaultSize) { this.defaultSize = defaultSize; }
        public int getMaxSize() { return maxSize; }
        public void setMaxSize(int maxSize) { this.maxSize = maxSize; }
    }

    public static class Sse {
        private long timeoutMs = 300_000;

        public long getTimeoutMs() { return timeoutMs; }
        public void setTimeoutMs(long timeoutMs) { this.timeoutMs = timeoutMs; }
    }

    public static class Optimization {
        private double defaultAlpha = 0.8;
        private double defaultBeta = 0.2;

        public double getDefaultAlpha() { return defaultAlpha; }
        public void setDefaultAlpha(double defaultAlpha) { this.defaultAlpha = defaultAlpha; }
        public double getDefaultBeta() { return defaultBeta; }
        public void setDefaultBeta(double defaultBeta) { this.defaultBeta = defaultBeta; }
    }
}
