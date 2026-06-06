package com.asap.server.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asap.server.dto.request.UpdateProfileRequest;
import com.asap.server.dto.response.ProfileResponse;
import com.asap.server.service.ProfileService;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @Operation(summary = "자신의 프로필 조회")
    @GetMapping("/me")
    public ResponseEntity<ProfileResponse> getMyProfile(@AuthenticationPrincipal Long userId) {

        return ResponseEntity.ok(profileService.getMyProfile(userId));
    }

    @Operation(summary = "프로필 생성/수정")
    @PatchMapping("/me")
    public ResponseEntity<ProfileResponse> patchMyProfile(
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(profileService.updateMyProfile(userId, request));
    }

    // 예시: /api/profile/chito-0001
    @Operation(summary = "타인 프로필 조회")
    @GetMapping("/{nicknameTag}")
    public ResponseEntity<ProfileResponse> getOtherProfile(@PathVariable String nicknameTag) {
        return ResponseEntity.ok(profileService.getOtherProfile(nicknameTag));
    }

}
