import React from "react";
import Editor from "@monaco-editor/react";
import { Language } from "../types";
import "./CodeEditor.css";

const LANGUAGE_OPTIONS: { label: string; value: Language }[] = [
  { label: "C++", value: "cpp" },
  { label: "Java", value: "java" },
  { label: "Python", value: "python" },
];

const LANGUAGE_DEFAULTS: Record<Language, string> = {

  cpp: "// 여기에 코드를 작성하세요\n\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n",
  java: "// 여기에 코드를 작성하세요\n\npublic class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n",
  python: "# 여기에 코드를 작성하세요\n\ndef solution():\n    pass\n",
};

interface Props {
  language: Language;
  code: string;
  onLanguageChange: (lang: Language) => void;
  onCodeChange: (code: string) => void;
}

const CodeEditor: React.FC<Props> = ({ language, code, onLanguageChange, onCodeChange }) => {
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as Language;
    onLanguageChange(newLang);
    onCodeChange(LANGUAGE_DEFAULTS[newLang]);
  };

  return (
    <div className="code-editor-wrapper">
      <div className="editor-toolbar">
        <span className="editor-label">언어 선택</span>
        <select
          className="language-select"
          value={language}
          onChange={handleLanguageChange}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="editor-body">
        <Editor
          height="100%"
          language={language === "cpp" ? "cpp" : language}
          value={code}
          onChange={(val) => onCodeChange(val ?? "")}
          theme="vs-dark"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 4,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
};

export { LANGUAGE_DEFAULTS };
export default CodeEditor;
