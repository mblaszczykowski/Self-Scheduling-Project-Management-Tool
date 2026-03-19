package com.backend.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;
import java.util.List;

public record OptimizationRequestDTO(
        List<String> projectKeys,
        Double alpha,
        Double beta,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate horizonStart
) {}
