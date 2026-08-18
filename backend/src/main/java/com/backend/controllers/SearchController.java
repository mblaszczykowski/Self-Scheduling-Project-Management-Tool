package com.backend.controllers;

import com.backend.dtos.SearchResultDTO;
import com.backend.services.SearchService;
import com.backend.web.CurrentUserId;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping
    public ResponseEntity<SearchResultDTO> search(@CurrentUserId Integer userId,
                                                 @RequestParam String q) {
        return ResponseEntity.ok(searchService.search(userId, q));
    }
}
