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

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping("/me")
    public ResponseEntity<ProfileResponse> getMyProfile(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(profileService.getMyProfile(email));
    }

    @PatchMapping("/me")
    public ResponseEntity<ProfileResponse> patchMyProfile(
            @AuthenticationPrincipal String email,
            @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(profileService.updateMyProfile(email, request));
    }

    // 예시: /api/profile/chito-0001
    @GetMapping("/{nicknameTag}")
    public ResponseEntity<ProfileResponse> getOtherProfile(@PathVariable String nicknameTag) {
        return ResponseEntity.ok(profileService.getOtherProfile(nicknameTag));
    }

}
