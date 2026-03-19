package com.backend.controllers;

import com.backend.dtos.OptimizationRequestDTO;
import com.backend.dtos.OptimizationResultDTO;
import com.backend.dtos.TaskScheduleSuggestionDTO;
import com.backend.services.OptimizationService;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/optimization")
public class OptimizationController {

    private final OptimizationService optimizationService;
    private final TokenService tokenService;

    public OptimizationController(OptimizationService optimizationService, TokenService tokenService) {
        this.optimizationService = optimizationService;
        this.tokenService = tokenService;
    }

    @PostMapping("/simulate")
    public ResponseEntity<OptimizationResultDTO> simulateOptimization(
            HttpServletRequest request,
            @RequestBody OptimizationRequestDTO requestDTO
    ) {
        var userId = tokenService.getUserIdFromRequest(request);

        double alpha = requestDTO.alpha() != null ? requestDTO.alpha() : 0.8;
        double beta = requestDTO.beta() != null ? requestDTO.beta() : 0.2;

        var result = optimizationService.optimizeSchedule(
                requestDTO.projectKeys(),
                userId,
                alpha,
                beta,
                requestDTO.horizonStart()
        );

        return ResponseEntity.ok(result);
    }

    @PostMapping("/apply")
    public ResponseEntity<Void> applyOptimization(
            HttpServletRequest request,
            @RequestBody List<TaskScheduleSuggestionDTO> suggestions
    ) {
        var userId = tokenService.getUserIdFromRequest(request);
        optimizationService.applyOptimization(suggestions, userId);
        return ResponseEntity.ok().build();
    }
}
