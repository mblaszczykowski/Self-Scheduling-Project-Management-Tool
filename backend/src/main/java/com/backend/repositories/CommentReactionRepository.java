package com.backend.repositories;

import com.backend.entities.CommentReaction;
import com.backend.entities.ReactionType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CommentReactionRepository extends JpaRepository<CommentReaction, Integer> {
    Optional<CommentReaction> findByCommentIdAndUserId(Integer commentId, Integer userId);
}
