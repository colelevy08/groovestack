// Social screen with two sections: users you already follow (with Unfollow), and suggested collectors to follow.
// onFollow toggles follow/unfollow in App.js — the same handler is used for both following and unfollowing.
// Suggestions are every USER_PROFILES entry the current user isn't already following.
import Avatar from '../ui/Avatar';
import { USER_PROFILES } from '../../constants';
import { getProfile } from '../../utils/helpers';

export default function FollowingScreen({ following, records, currentUser, onFollow, onViewUser }) {
  // Exclude the current user from the full user list
  const allUsers = Object.keys(USER_PROFILES).filter(u => u !== currentUser);
  // Suggestions are all users not already being followed
  const suggestions = allUsers.filter(u => !following.includes(u));

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "#f5f5f5", marginBottom: 6 }}>Following</h1>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 22 }}>Following {following.length} collectors</p>

      {following.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.08em", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>PEOPLE YOU FOLLOW</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {following.map(u => {
              const p = getProfile(u);
              const uRecs = records.filter(r => r.user === u);
              return (
                <div key={u} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 13, padding: "14px 16px", display: "flex", gap: 13, alignItems: "center" }}>
                  <Avatar username={u} size={44} onClick={() => onViewUser(u)} />
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onViewUser(u)}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{p.displayName}</div>
                    <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace" }}>@{u}</div>
                    {p.bio && <div style={{ fontSize: 12, color: "#777", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bio}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>{uRecs.length} records</div>
                    <button onClick={() => onFollow(u)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #2a2a2a", background: "#1a1a1a", color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Unfollow</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.08em", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>SUGGESTED COLLECTORS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {suggestions.map(u => {
          const p = getProfile(u);
          const uRecs = records.filter(r => r.user === u);
          return (
            <div key={u} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 13, padding: "14px 16px", display: "flex", gap: 13, alignItems: "center" }}>
              <Avatar username={u} size={44} onClick={() => onViewUser(u)} />
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onViewUser(u)}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{p.displayName}</div>
                <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace" }}>@{u}</div>
                {p.bio && <div style={{ fontSize: 12, color: "#777", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bio}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {p.favGenre && <span style={{ fontSize: "10px", padding: "1px 7px", borderRadius: 20, background: "#1a1a1a", color: "#555", border: "1px solid #2a2a2a" }}>{p.favGenre}</span>}
                  <span style={{ fontSize: "10px", padding: "1px 7px", borderRadius: 20, background: "#1a1a1a", color: "#555", border: "1px solid #2a2a2a" }}>{uRecs.length} records</span>
                </div>
              </div>
              <button onClick={() => onFollow(u)} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                Follow
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
