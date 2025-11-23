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

import java.util.List;

@RestController
@RequestMapping("api/search")
public class SearchController {
    private final SearchService searchService;
    private final TokenService tokenService;

    public SearchController(SearchService searchService, TokenService tokenService) {
        this.searchService = searchService;
        this.tokenService = tokenService;
    }

    @GetMapping
    public ResponseEntity<List<SearchResultDTO>> search(@RequestParam("q") String query, HttpServletRequest request) {
        Integer userId = tokenService.getUserIdFromRequest(request);
        List<SearchResultDTO> results = searchService.search(query, userId);
        return ResponseEntity.ok(results);
    }
}
