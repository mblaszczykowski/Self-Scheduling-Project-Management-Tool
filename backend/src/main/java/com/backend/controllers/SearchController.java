package com.backend.controllers;

import com.backend.dtos.SearchResultDTO;
import com.backend.services.SearchService;
import com.backend.services.TokenService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;
    private final TokenService tokenService;

    public SearchController(SearchService searchService, TokenService tokenService) {
        this.searchService = searchService;
        this.tokenService = tokenService;
    }

    @GetMapping
    public ResponseEntity<SearchResultDTO> search(
            HttpServletRequest request,
            @RequestParam String q
    ) {
        int userId = tokenService.getUserIdFromRequest(request);
        return ResponseEntity.ok(searchService.search(userId, q));
    }
}
