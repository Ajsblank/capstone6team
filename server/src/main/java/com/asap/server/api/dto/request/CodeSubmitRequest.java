package com.asap.server.api.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodeSubmitRequest {
    private String userId;
    private String language;
    private String sourceCode;
}
