import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { getMyProfile, updateMyProfile, UserProfile, UserProfilePatch } from "../api/codeBattleApi";
import "./ProfilePage.css";

const ProfilePage: React.FC = () => {
  const { user, navigate } = useApp();

  const [profile,     setProfile]     = useState<UserProfile | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveErr,     setSaveErr]     = useState<string | null>(null);

  const [draft, setDraft] = useState<UserProfilePatch>({});

  useEffect(() => {
    setLoading(true);
    setFetchFailed(false);
    getMyProfile()
      .then(data => setProfile(data))
      .catch(() => setFetchFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = () => {
    setDraft({
      nickname:    profile?.nickname    ?? user?.username ?? "",
      bio:         profile?.bio         ?? "",
      affiliation: profile?.affiliation ?? "",
      imageUrl:    profile?.imageUrl    ?? "",
    });
    setSaveErr(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveErr(null);
  };

  const saveEdit = async () => {
    if (!draft.nickname?.trim()) {
      setSaveErr("닉네임은 필수입니다.");
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      const payload: UserProfilePatch = {
        nickname:    draft.nickname?.trim()    ?? "",
        bio:         draft.bio?.trim()         ?? "",
        affiliation: draft.affiliation?.trim() ?? "",
        imageUrl:    draft.imageUrl?.trim()    ?? "",
      };
      const updated = await updateMyProfile(payload);
      setProfile(updated);
      setFetchFailed(false);
      setEditing(false);
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message ?? err?.response?.data;
      setSaveErr(
        typeof serverMsg === "string"
          ? serverMsg
          : serverMsg
          ? JSON.stringify(serverMsg)
          : "저장에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof UserProfilePatch) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(prev => ({ ...prev, [field]: e.target.value }));

  // 프로필 이미지 업로드 → base64 data URL로 변환해 draft.imageUrl에 저장(서버 전송)
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 가능하게
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveErr("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSaveErr("이미지 크기는 2MB 이하만 가능합니다.");
      return;
    }
    setSaveErr(null);
    const reader = new FileReader();
    reader.onload = () => setDraft(prev => ({ ...prev, imageUrl: String(reader.result) }));
    reader.onerror = () => setSaveErr("이미지를 읽지 못했습니다.");
    reader.readAsDataURL(file); // → "data:image/...;base64,...."
  };

  if (!user) {
    return (
      <div className="pp-center">
        <p className="pp-error">로그인이 필요합니다.</p>
        <button className="pp-btn pp-btn--ghost" onClick={() => navigate("login")}>로그인</button>
      </div>
    );
  }

  const displayNickname = profile?.nicknameTag || profile?.nickname || user.username;
  const displayImageUrl = editing ? (draft.imageUrl ?? "") : (profile?.imageUrl ?? "");

  return (
    <div className="pp-root">
      <div className="pp-card">
        {/* 상단 헤더 */}
        <div className="pp-card-header">
          <button className="pp-back-btn" onClick={() => window.history.back()}>← 이전으로</button>
          <h1 className="pp-card-title">프로필</h1>
          {!editing && !loading && (
            <button className="pp-btn pp-btn--primary" onClick={startEdit}>
              {fetchFailed ? "프로필 변경" : "수정"}
            </button>
          )}
          {editing && (
            <div className="pp-edit-actions">
              <button className="pp-btn pp-btn--ghost" onClick={cancelEdit} disabled={saving}>취소</button>
              <button className="pp-btn pp-btn--primary" onClick={saveEdit} disabled={saving}>
                {saving ? "저장 중..." : "수정 완료"}
              </button>
            </div>
          )}
        </div>

        {loading && <div className="pp-status">불러오는 중...</div>}

        {!loading && (
          <div className="pp-body">
            {fetchFailed && !editing && (
              <p className="pp-fetch-notice">프로필 정보를 불러오지 못했습니다. 프로필을 새로 추가할 수 있습니다.</p>
            )}

            {/* 아바타 */}
            <div className="pp-avatar-wrap">
              {displayImageUrl ? (
                <img
                  className="pp-avatar-img"
                  src={displayImageUrl}
                  alt="프로필 이미지"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="pp-avatar-default">👤</div>
              )}
            </div>

            {/* 이미지 업로드 (편집 모드) — base64로 변환되어 서버에 전송됨 */}
            {editing && (
              <div className="pp-field pp-field--full">
                <label className="pp-label">프로필 이미지</label>
                <div className="pp-image-actions">
                  <label className="pp-btn pp-btn--ghost pp-upload-btn">
                    이미지 업로드
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                  </label>
                  {draft.imageUrl ? (
                    <button
                      type="button"
                      className="pp-btn pp-btn--ghost"
                      onClick={() => setDraft(prev => ({ ...prev, imageUrl: "" }))}
                    >
                      이미지 제거
                    </button>
                  ) : null}
                </div>
                <p className="pp-upload-hint">JPG/PNG 등 이미지 파일, 최대 2MB</p>
              </div>
            )}

            {/* 닉네임 */}
            <div className="pp-field">
              <label className="pp-label">닉네임</label>
              {editing ? (
                <input className="pp-input" value={draft.nickname ?? ""} onChange={set("nickname")} maxLength={20} />
              ) : (
                <span className="pp-value pp-value--name">
                  {displayNickname}
                  {profile && profile.tag > 0 && !profile.nicknameTag && (
                    <span className="pp-tag">#{profile.tagCode || String(profile.tag).padStart(4, "0")}</span>
                  )}
                </span>
              )}
            </div>

            {/* 이메일 (읽기 전용) */}
            <div className="pp-field">
              <label className="pp-label">이메일</label>
              <span className="pp-value pp-value--muted">{user.email ?? "-"}</span>
            </div>

            {/* 소속 */}
            <div className="pp-field">
              <label className="pp-label">소속</label>
              {editing ? (
                <input className="pp-input" value={draft.affiliation ?? ""} onChange={set("affiliation")} placeholder="학교 / 회사 / 팀명" />
              ) : (
                <span className="pp-value pp-value--muted">{profile?.affiliation || "-"}</span>
              )}
            </div>

            {/* 소개 */}
            <div className="pp-field pp-field--full">
              <label className="pp-label">소개</label>
              {editing ? (
                <textarea className="pp-textarea" value={draft.bio ?? ""} onChange={set("bio")} rows={4} placeholder="자신을 소개해보세요" />
              ) : (
                <span className="pp-value pp-value--bio pp-value--muted">{profile?.bio || "-"}</span>
              )}
            </div>

            {saveErr && <p className="pp-save-error">{saveErr}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
