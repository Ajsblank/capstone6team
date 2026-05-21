import React, { useEffect, useRef } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import ImageExt from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import "./RichTextEditor.css";

// ── 툴바 버튼 ──────────────────────────────────────────────────────────
interface BtnProps {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}
const Btn: React.FC<BtnProps> = ({ active, title, onClick, children }) => (
  <button
    type="button"
    title={title}
    className={`rte-btn${active ? " rte-btn--active" : ""}`}
    onMouseDown={e => { e.preventDefault(); onClick(); }}
  >
    {children}
  </button>
);

// ── 툴바 ───────────────────────────────────────────────────────────────
const Toolbar: React.FC<{ editor: Editor }> = ({ editor }) => {
  const colorRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      editor.chain().focus().setImage({ src: reader.result as string }).run();
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleLink = () => {
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("링크 URL", prev || "https://");
    if (url === null) return;
    if (!url) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };

  const currentColor = editor.getAttributes("textStyle").color ?? "#111827";

  const headingValue =
    editor.isActive("heading", { level: 1 }) ? "1" :
    editor.isActive("heading", { level: 2 }) ? "2" :
    editor.isActive("heading", { level: 3 }) ? "3" : "0";

  return (
    <div className="rte-toolbar">

      {/* 제목 */}
      <select
        className="rte-select"
        value={headingValue}
        onChange={e => {
          const v = Number(e.target.value);
          if (v === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: v as 1 | 2 | 3 }).run();
        }}
      >
        <option value="0">본문</option>
        <option value="1">제목 1</option>
        <option value="2">제목 2</option>
        <option value="3">제목 3</option>
      </select>

      <span className="rte-divider" />

      {/* 글자 서식 */}
      <Btn active={editor.isActive("bold")}      title="굵게 (Ctrl+B)"   onClick={() => editor.chain().focus().toggleBold().run()}>      <b>B</b>      </Btn>
      <Btn active={editor.isActive("italic")}    title="기울임 (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()}>    <i>I</i>      </Btn>
      <Btn active={editor.isActive("underline")} title="밑줄 (Ctrl+U)"   onClick={() => editor.chain().focus().toggleUnderline().run()}> <u>U</u>      </Btn>
      <Btn active={editor.isActive("strike")}    title="취소선"           onClick={() => editor.chain().focus().toggleStrike().run()}>    <s>S</s>      </Btn>
      <Btn active={editor.isActive("code")}      title="인라인 코드"     onClick={() => editor.chain().focus().toggleCode().run()}>      <code>&lt;/&gt;</code></Btn>

      <span className="rte-divider" />

      {/* 색상 */}
      <span className="rte-color-wrap" title="글자 색">
        <button
          type="button"
          className="rte-btn rte-color-btn"
          onMouseDown={e => { e.preventDefault(); colorRef.current?.click(); }}
        >
          <span className="rte-color-a" style={{ "--rte-color": currentColor } as React.CSSProperties}>A</span>
        </button>
        <input
          ref={colorRef}
          type="color"
          className="rte-color-input"
          value={currentColor}
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
        />
      </span>

      <Btn active={editor.isActive("highlight")} title="형광펜" onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <span className="rte-highlight-a">A</span>
      </Btn>

      <Btn title="서식 지우기" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <span className="rte-eraser">✕</span>
      </Btn>

      <span className="rte-divider" />

      {/* 목록 · 인용 */}
      <Btn active={editor.isActive("bulletList")}  title="불릿 목록" onClick={() => editor.chain().focus().toggleBulletList().run()}>  • —  </Btn>
      <Btn active={editor.isActive("orderedList")} title="번호 목록" onClick={() => editor.chain().focus().toggleOrderedList().run()}> 1. —  </Btn>
      <Btn active={editor.isActive("blockquote")}  title="인용문"   onClick={() => editor.chain().focus().toggleBlockquote().run()}>   ❝    </Btn>
      <Btn active={editor.isActive("codeBlock")}   title="코드 블록" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>  { }   </Btn>

      <span className="rte-divider" />

      {/* 정렬 */}
      <Btn active={editor.isActive({ textAlign: "left" })}   title="왼쪽 정렬"   onClick={() => editor.chain().focus().setTextAlign("left").run()}>   ≡←  </Btn>
      <Btn active={editor.isActive({ textAlign: "center" })} title="가운데 정렬" onClick={() => editor.chain().focus().setTextAlign("center").run()}> ≡↔  </Btn>
      <Btn active={editor.isActive({ textAlign: "right" })}  title="오른쪽 정렬" onClick={() => editor.chain().focus().setTextAlign("right").run()}>  ≡→  </Btn>

      <span className="rte-divider" />

      {/* 삽입 */}
      <Btn active={editor.isActive("link")} title="링크 삽입"  onClick={handleLink}>                             🔗  </Btn>
      <Btn                                  title="이미지 삽입" onClick={() => imageRef.current?.click()}>         🖼  </Btn>
      <Btn                                  title="가로 구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}> —  </Btn>

      <input ref={imageRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} />
    </div>
  );
};

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────
interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const RichTextEditor: React.FC<Props> = ({
  value,
  onChange,
  placeholder = "내용을 입력하세요.",
  minHeight = 280,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      ImageExt.configure({ allowBase64: true }),
      LinkExt.configure({ openOnClick: false }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    onUpdate({ editor: e }) {
      onChange(e.getHTML());
    },
  });

  // 외부에서 value가 바뀔 때 (예: 초기화) 에디터 동기화
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="rte-wrapper">
      {editor && <Toolbar editor={editor} />}
      <div className="rte-body" style={{ minHeight }}>
        <EditorContent
          editor={editor}
          className="rte-content"
          data-placeholder={placeholder}
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
