package com.backend.controllers;

import com.backend.config.AppProperties;
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
    private final AppProperties appProperties;

    public OptimizationController(OptimizationService optimizationService, TokenService tokenService,
                                  AppProperties appProperties) {
        this.optimizationService = optimizationService;
        this.tokenService = tokenService;
        this.appProperties = appProperties;
    }

    @PostMapping("/simulate")
    public ResponseEntity<OptimizationResultDTO> simulateOptimization(
            HttpServletRequest request,
            @RequestBody OptimizationRequestDTO requestDTO
    ) {
        var userId = tokenService.getUserIdFromRequest(request);

        var optimization = appProperties.getOptimization();
        double alpha = requestDTO.alpha() != null ? requestDTO.alpha() : optimization.getDefaultAlpha();
        double beta = requestDTO.beta() != null ? requestDTO.beta() : optimization.getDefaultBeta();

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
