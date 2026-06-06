import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { getMyProfile, UserProfile } from "../api/codeBattleApi";
import "./ProfileBadge.css";

// ── 프로필 캐시 (헤더가 페이지마다 마운트되어도 1회만 조회) ──
let cachedProfile: UserProfile | null = null;
let inflight: Promise<UserProfile> | null = null;

export function clearMyProfileCache() {
  cachedProfile = null;
  inflight = null;
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
    if (!user) return;
    if (cachedProfile) { setProfile(cachedProfile); return; }
    if (!inflight) {
      inflight = getMyProfile()
        .then(p => { cachedProfile = p; return p; })
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
      />
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
