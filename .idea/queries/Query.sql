CREATE TABLE refresh_tokens (
                                id BIGSERIAL PRIMARY KEY,
                                token VARCHAR(255) NOT NULL UNIQUE,
                                user_id INTEGER NOT NULL,
                                expiry_date TIMESTAMP NOT NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                INDEX idx_refresh_token (token),
                                INDEX idx_refresh_user (user_id)
);