package com.backend.controllers;

import com.backend.dtos.OptimizationResultDTO;
import com.backend.requests.ApplyOptimizationRequest;
import com.backend.requests.OptimizationRequest;
import com.backend.services.OptimizationService;
import com.backend.web.CurrentUserId;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/optimization")
public class OptimizationController {

    private final OptimizationService optimizationService;

    public OptimizationController(OptimizationService optimizationService) {
        this.optimizationService = optimizationService;
    }

    @PostMapping("/simulate")
    public ResponseEntity<OptimizationResultDTO> simulate(
            @CurrentUserId Integer userId,
            @Valid @RequestBody OptimizationRequest request
    ) {
        return ResponseEntity.ok(optimizationService.simulate(request, userId));
    }

    /**
     * Applies an optimization by recomputing it server-side, rather than writing dates the browser
     * echoed back.
     */
    @PostMapping("/apply")
    public ResponseEntity<AppliedSchedule> apply(
            @CurrentUserId Integer userId,
            @Valid @RequestBody ApplyOptimizationRequest request
    ) {
        return ResponseEntity.ok(new AppliedSchedule(optimizationService.apply(request, userId)));
    }

    public record AppliedSchedule(int tasksUpdated) {}
}
