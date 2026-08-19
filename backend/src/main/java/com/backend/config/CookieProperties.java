package com.backend.config;

import jakarta.annotation.PostConstruct;
import jakarta.validation.constraints.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Component
@ConfigurationProperties(prefix = "app.cookie")
@Validated
public class CookieProperties {

    private static final Logger log = LoggerFactory.getLogger(CookieProperties.class);

    // Secure by default: auth cookies must only travel over HTTPS. Local HTTP dev must
    // explicitly opt out with COOKIE_SECURE=false.
    private boolean secure = true;
    @Pattern(regexp = "Lax|Strict|None", message = "app.cookie.same-site must be Lax, Strict or None")
    private String sameSite = "Lax";

    @PostConstruct
    void warnIfInsecure() {
        if (!secure) {
            log.warn("app.cookie.secure=false — auth cookies will be sent over plain HTTP. "
                    + "This is intended only for local development; set COOKIE_SECURE=true in any "
                    + "internet-facing/HTTPS deployment.");
        }
    }

    public boolean isSecure() { return secure; }
    public void setSecure(boolean secure) { this.secure = secure; }
    public String getSameSite() { return sameSite; }
    public void setSameSite(String sameSite) { this.sameSite = sameSite; }
}
