package com.asap.server.api.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class CodeSubmitResponse {
    private boolean success;
    private String message;
}
