package com.backend.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "app")
@Validated
public class AppProperties {
    private Pagination pagination = new Pagination();
    private Sse sse = new Sse();
    private Optimization optimization = new Optimization();
    private Cors cors = new Cors();
    private RateLimit rateLimit = new RateLimit();
    private Mail mail = new Mail();
    private Storage storage = new Storage();
    private Frontend frontend = new Frontend();
    private Session session = new Session();

    public Pagination getPagination() { return pagination; }
    public void setPagination(Pagination pagination) { this.pagination = pagination; }
    public Sse getSse() { return sse; }
    public void setSse(Sse sse) { this.sse = sse; }
    public Optimization getOptimization() { return optimization; }
    public void setOptimization(Optimization optimization) { this.optimization = optimization; }
    public Cors getCors() { return cors; }
    public void setCors(Cors cors) { this.cors = cors; }
    public RateLimit getRateLimit() { return rateLimit; }
    public void setRateLimit(RateLimit rateLimit) { this.rateLimit = rateLimit; }
    public Mail getMail() { return mail; }
    public void setMail(Mail mail) { this.mail = mail; }
    public Storage getStorage() { return storage; }
    public void setStorage(Storage storage) { this.storage = storage; }
    public Frontend getFrontend() { return frontend; }
    public void setFrontend(Frontend frontend) { this.frontend = frontend; }
    public Session getSession() { return session; }
    public void setSession(Session session) { this.session = session; }

    public static class Cors {
        private List<String> allowedOrigins = List.of("http://localhost:3000");

        public List<String> getAllowedOrigins() { return allowedOrigins; }
        public void setAllowedOrigins(List<String> allowedOrigins) { this.allowedOrigins = allowedOrigins; }
    }

    public static class Pagination {
        @Min(1) private int defaultSize = 50;
        @Min(1) private int maxSize = 100;

        public int getDefaultSize() { return defaultSize; }
        public void setDefaultSize(int defaultSize) { this.defaultSize = defaultSize; }
        public int getMaxSize() { return maxSize; }
        public void setMaxSize(int maxSize) { this.maxSize = maxSize; }
    }

    public static class Sse {
        @Min(1000) private long timeoutMs = 300_000;
        @Min(1) private int maxEmittersPerUser = 4;

        public long getTimeoutMs() { return timeoutMs; }
        public void setTimeoutMs(long timeoutMs) { this.timeoutMs = timeoutMs; }
        public int getMaxEmittersPerUser() { return maxEmittersPerUser; }
        public void setMaxEmittersPerUser(int maxEmittersPerUser) { this.maxEmittersPerUser = maxEmittersPerUser; }
    }

    public static class Optimization {
        @DecimalMin("0.0") @DecimalMax("1.0") private double defaultAlpha = 0.8;
        @DecimalMin("0.0") @DecimalMax("1.0") private double defaultBeta = 0.2;
        @Min(1) private int maxHorizonDays = 3650;
        @Min(1) private int minHorizonDays = 30;
        private double dependencyWeight = 5.0;
        @Min(0) private int horizonStartMaxPastDays = 30;
        @Min(0) private int horizonStartMaxFutureDays = 365;

        public double getDefaultAlpha() { return defaultAlpha; }
        public void setDefaultAlpha(double defaultAlpha) { this.defaultAlpha = defaultAlpha; }
        public double getDefaultBeta() { return defaultBeta; }
        public void setDefaultBeta(double defaultBeta) { this.defaultBeta = defaultBeta; }
        public int getMaxHorizonDays() { return maxHorizonDays; }
        public void setMaxHorizonDays(int maxHorizonDays) { this.maxHorizonDays = maxHorizonDays; }
        public int getMinHorizonDays() { return minHorizonDays; }
        public void setMinHorizonDays(int minHorizonDays) { this.minHorizonDays = minHorizonDays; }
        public double getDependencyWeight() { return dependencyWeight; }
        public void setDependencyWeight(double dependencyWeight) { this.dependencyWeight = dependencyWeight; }
        public int getHorizonStartMaxPastDays() { return horizonStartMaxPastDays; }
        public void setHorizonStartMaxPastDays(int d) { this.horizonStartMaxPastDays = d; }
        public int getHorizonStartMaxFutureDays() { return horizonStartMaxFutureDays; }
        public void setHorizonStartMaxFutureDays(int d) { this.horizonStartMaxFutureDays = d; }
    }

    public static class RateLimit {
        @Min(1) private long windowMs = 900_000;
        @Min(1) private int login = 5;
        @Min(1) private int register = 3;
        @Min(1) private int write = 300;
        @Min(1) private int optimize = 30;
        @Min(1) private int search = 120;
        @Min(1) private int invitation = 50;

        public long getWindowMs() { return windowMs; }
        public void setWindowMs(long windowMs) { this.windowMs = windowMs; }
        public int getLogin() { return login; }
        public void setLogin(int login) { this.login = login; }
        public int getRegister() { return register; }
        public void setRegister(int register) { this.register = register; }
        public int getWrite() { return write; }
        public void setWrite(int write) { this.write = write; }
        public int getOptimize() { return optimize; }
        public void setOptimize(int optimize) { this.optimize = optimize; }
        public int getSearch() { return search; }
        public void setSearch(int search) { this.search = search; }
        public int getInvitation() { return invitation; }
        public void setInvitation(int invitation) { this.invitation = invitation; }
    }

    public static class Mail {
        private boolean enabled = false;
        @NotBlank private String from = "noreply@example.com";

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }
    }

    public static class Storage {
        @NotBlank private String uploadDir = "uploads";

        public String getUploadDir() { return uploadDir; }
        public void setUploadDir(String uploadDir) { this.uploadDir = uploadDir; }
    }

    public static class Frontend {
        @NotBlank private String baseUrl = "http://localhost:3000";

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    }

    public static class Session {
        @Min(1) private int absoluteMaxDays = 30;

        public int getAbsoluteMaxDays() { return absoluteMaxDays; }
        public void setAbsoluteMaxDays(int absoluteMaxDays) { this.absoluteMaxDays = absoluteMaxDays; }
    }
}
