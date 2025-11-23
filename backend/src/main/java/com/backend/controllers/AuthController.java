package com.backend.controllers;

import com.backend.requests.LoginRequest;
import com.backend.services.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("api/auth")
@CrossOrigin(
        origins = "http://localhost:3000",
        allowCredentials = "true"
)
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        return authService.authenticateUser(request);
    }

    @DeleteMapping("logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        authService.logoutUser(response);
        return ResponseEntity.ok().build();
    }
}
