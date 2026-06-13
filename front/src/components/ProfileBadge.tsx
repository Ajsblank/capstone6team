import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { getMyProfile, UserProfile } from "../api/codeBattleApi";
import "./ProfileBadge.css";

// ── 프로필 캐시 (로그인 시 저장, 로그아웃 전까지 localStorage에 유지) ──
const PROFILE_STORAGE_KEY = "myProfile";

function loadProfileFromStorage(): UserProfile | null {
  try {
    const s = localStorage.getItem(PROFILE_STORAGE_KEY);
    return s ? (JSON.parse(s) as UserProfile) : null;
  } catch { return null; }
}

let cachedProfile: UserProfile | null = loadProfileFromStorage();
let inflight: Promise<UserProfile> | null = null;

export function clearMyProfileCache() {
  cachedProfile = null;
  inflight = null;
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}

export function setMyProfileCache(profile: UserProfile) {
  cachedProfile = profile;
  try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); } catch { /* quota 초과 등 무시 */ }
}

interface Props {
  /** 아바타 원 클래스 (테마별: home-avatar / lp-avatar) */
  avatarClass?: string;
  /** 유저 정보 래퍼 클래스 (테마별 색상: home-username / lp-username) */
  usernameClass?: string;
}

const ProfileBadge: React.FC<Props> = ({
  avatarClass = "home-avatar",
  usernameClass = "home-username",
}) => {
  const { user, navigate } = useApp();
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    if (cachedProfile) { setProfile(cachedProfile); return; }
    setProfile(null);   // 계정 전환 시 이전 계정 정보 즉시 제거(재조회 전까지 stale 방지)
    if (!inflight) {
      inflight = getMyProfile()
        .then(p => { setMyProfileCache(p); return p; })
        .finally(() => { inflight = null; });
    }
    let active = true;
    inflight.then(p => { if (active) setProfile(p); }).catch(() => {});
    return () => { active = false; };
  }, [user]);

  if (!user) return null;

  const goProfile = () => navigate("profile");

  const email      = user.email ?? user.username;
  const nickname   = profile?.nickname || user.username;
  const tagText    = profile?.tagCode || (profile?.tag ? String(profile.tag).padStart(3, "0") : "");
  const imageUrl   = profile?.imageUrl;

  return (
    <>
      <span
        className={avatarClass}
        onClick={goProfile}
        title="프로필"
        style={imageUrl ? {
          backgroundImage: `url("${imageUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : undefined}
      >
        {!imageUrl && <span className="pb-avatar-default">👤</span>}
      </span>
      <span className={`${usernameClass} pb-username`} onClick={goProfile} title="프로필">
        <span className="pb-email">{email}</span>
        <span className="pb-sub">
          <span className="pb-nick">{nickname}</span>
          {tagText && <span className="pb-tag">#{tagText}</span>}
        </span>
      </span>
    </>
  );
};

export default ProfileBadge;
