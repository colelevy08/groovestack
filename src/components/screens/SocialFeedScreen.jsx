// Social feed — user-created posts with tagged records, likes, comments, and bookmarks.
// This replaces the old Feed as the main landing screen. Posts are the social layer on top of the record catalog.
// Includes a compose prompt that opens CreatePostModal, filter tabs (All / Following / Saved), and post cards with interactions.
// Features: Trending section, post type filters, infinite scroll, redesigned cards, engagement metrics.
// Improvements: Stories, post scheduling, expanded filters, trending hashtags, post analytics,
// live listening, polls, events, community challenges, saved posts tab, post templates, cross-post.
// v2 Improvements: Rich formatting toolbar, scheduling UI, per-post analytics, repost/share,
// post pinning, content warnings, location tagging, collections, drafts, reach indicator,
// suggested posts, expiration timer, anonymous posting, templates gallery, trending sidebar,
// guidelines reminder, engagement rewards, auto-hashtags, sentiment indicator, cross-platform share,
// accessibility alt text, reported content toggle, pull-to-refresh, new posts bar, feed density toggle.
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Empty from '../ui/Empty';
import { getProfile } from '../../utils/helpers';

const POST_TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "reviews", label: "Reviews" },
  { id: "discussions", label: "Discussions" },
  { id: "photos", label: "Photos" },
  { id: "trades", label: "Trades" },
  { id: "questions", label: "Questions" },
  { id: "polls", label: "Polls" },
  { id: "events", label: "Events" },
];

// Feed density options (Improvement 25)
const FEED_DENSITIES = [
  { id: "compact", label: "Compact", gap: "gap-2", padding: "p-3" },
  { id: "comfortable", label: "Comfortable", gap: "gap-4", padding: "p-5" },
  { id: "spacious", label: "Spacious", gap: "gap-6", padding: "p-7" },
];

// Infer post type from content — expanded for new types
function inferPostType(post) {
  if (post.postType) return post.postType;
  if (post.pollOptions) return "polls";
  if (post.eventDate) return "events";
  if (post.tradeOffer) return "trades";
  if (post.caption && post.caption.endsWith('?')) return "questions";
  if (post.mediaUrl) return "photos";
  if (post.taggedRecord) return "reviews";
  return "discussions";
}

// Improvement 19: Analyze sentiment from caption text
function analyzeSentiment(caption) {
  if (!caption) return { label: 'neutral', color: '#888', icon: '--' };
  const lower = caption.toLowerCase();
  const positiveWords = ['love', 'amazing', 'great', 'awesome', 'beautiful', 'fantastic', 'excellent', 'incredible', 'perfect', 'favorite', 'brilliant', 'masterpiece', 'gem', 'fire', 'best'];
  const negativeWords = ['hate', 'terrible', 'awful', 'bad', 'worst', 'boring', 'disappointing', 'overrated', 'skip', 'meh', 'mediocre', 'trash'];
  const posCount = positiveWords.filter(w => lower.includes(w)).length;
  const negCount = negativeWords.filter(w => lower.includes(w)).length;
  if (posCount > negCount) return { label: 'positive', color: '#22c55e', icon: '+' };
  if (negCount > posCount) return { label: 'negative', color: '#ef4444', icon: '-' };
  return { label: 'neutral', color: '#888', icon: '~' };
}

// Improvement 18: Generate auto-hashtag suggestions based on post content
function suggestHashtags(caption, taggedRecord) {
  const suggestions = [];
  const lower = (caption || '').toLowerCase();
  if (taggedRecord) {
    suggestions.push(`#${taggedRecord.artist.replace(/\s+/g, '').toLowerCase()}`);
    suggestions.push('#nowplaying');
  }
  if (lower.includes('vinyl') || lower.includes('record')) suggestions.push('#vinylcollection');
  if (lower.includes('spin') || lower.includes('listening')) suggestions.push('#spinning');
  if (lower.includes('rare') || lower.includes('find')) suggestions.push('#rarefind');
  if (lower.includes('trade') || lower.includes('swap')) suggestions.push('#vinyltrade');
  if (lower.includes('review')) suggestions.push('#albumreview');
  if (lower.includes('crate') || lower.includes('dig')) suggestions.push('#cratedigger');
  // Deduplicate
  return [...new Set(suggestions)].slice(0, 5);
}

// Improvement 1 (enhanced): Rich formatting toolbar for composer
function RichFormatToolbar({ onInsert }) {
  const tools = [
    { icon: 'B', label: 'Bold', action: () => onInsert?.('**', '**') },
    { icon: 'I', label: 'Italic', action: () => onInsert?.('_', '_') },
    { icon: '~', label: 'Strikethrough', action: () => onInsert?.('~~', '~~') },
    { icon: '#', label: 'Heading', action: () => onInsert?.('\n## ', '') },
    { icon: '"', label: 'Quote', action: () => onInsert?.('\n> ', '') },
    { icon: '-', label: 'List', action: () => onInsert?.('\n- ', '') },
    { icon: '@', label: 'Mention', action: () => onInsert?.('@', '') },
    { icon: '#', label: 'Hashtag', action: () => onInsert?.('#', '') },
  ];
  return (
    <div className="flex gap-1 py-1.5 border-t border-gs-border mt-2">
      {tools.map((t, i) => (
        <button
          key={i}
          onClick={t.action}
          title={t.label}
          className="w-7 h-7 rounded bg-[#111] border border-[#1a1a1a] text-gs-dim text-[11px] font-bold cursor-pointer hover:border-gs-accent/30 hover:text-gs-accent transition-colors flex items-center justify-center"
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

// Improvement 2: Post scheduling UI
function SchedulePostUI({ scheduledDate, onScheduleChange, onClear }) {
  return (
    <div className="flex items-center gap-2 mt-2 p-2 bg-[#111] rounded-lg border border-gs-border">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <input
        type="datetime-local"
        value={scheduledDate || ''}
        onChange={e => onScheduleChange(e.target.value)}
        className="bg-transparent border-none text-[11px] text-gs-muted font-mono outline-none flex-1"
      />
      {scheduledDate && (
        <button onClick={onClear} className="text-[10px] text-red-400 bg-transparent border-none cursor-pointer hover:text-red-300">
          Clear
        </button>
      )}
    </div>
  );
}

// Improvement 9: Drafts management panel
function DraftsPanel({ drafts, onLoadDraft, onDeleteDraft, onClose }) {
  if (!drafts || drafts.length === 0) {
    return (
      <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Drafts</span>
          <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer hover:text-gs-muted">&times;</button>
        </div>
        <p className="text-[11px] text-gs-faint">No drafts saved. Start composing and save a draft!</p>
      </div>
    );
  }
  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Drafts ({drafts.length})</span>
        <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer hover:text-gs-muted">&times;</button>
      </div>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {drafts.map((d, i) => (
          <div key={i} className="flex items-center gap-2 p-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gs-muted truncate">{d.caption || '(empty draft)'}</p>
              <span className="text-[9px] text-gs-faint font-mono">{new Date(d.savedAt).toLocaleDateString()}</span>
            </div>
            <button onClick={() => onLoadDraft(d)} className="text-[10px] text-gs-accent bg-transparent border border-gs-accent/30 rounded px-2 py-0.5 cursor-pointer hover:bg-gs-accent/10">Load</button>
            <button onClick={() => onDeleteDraft(i)} className="text-[10px] text-red-400 bg-transparent border-none cursor-pointer hover:text-red-300">Del</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Improvement 14: Post templates gallery
function PostTemplatesGallery({ onSelectTemplate, onClose }) {
  const templates = [
    { id: 1, title: "Album Review", icon: "★", body: "Just listened to [album] by [artist]. Here's my take:\n\nFavorite tracks: \nRating: /10\nVibe: " },
    { id: 2, title: "Trade Offer", icon: "↔", body: "Looking to trade:\n\nOffering: [your record]\nWanting: [desired record]\nCondition: \nLocation: " },
    { id: 3, title: "Question", icon: "?", body: "Does anyone know... ?\n\nContext: " },
    { id: 4, title: "Recommendation", icon: "♫", body: "If you like [artist], you should check out:\n\n1. \n2. \n3. " },
    { id: 5, title: "Collection Update", icon: "📦", body: "New additions to the collection!\n\n🎵 [album] - [artist]\nFormat: \nCondition: \nHow I found it: " },
    { id: 6, title: "Crate Dig Report", icon: "🔍", body: "Just hit up [store name]!\n\nBest finds:\n- \n- \n\nTotal spent: $\nWorth it? " },
    { id: 7, title: "Hot Take", icon: "🔥", body: "Hot take: \n\nHear me out..." },
    { id: 8, title: "Weekly Rotation", icon: "🔄", body: "This week's heavy rotation:\n\n1. \n2. \n3. \n4. \n5. \n\nWhat's on yours?" },
  ];

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Templates Gallery</span>
        <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer hover:text-gs-muted">&times;</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t)}
            className="text-left p-2.5 bg-[#111] border border-[#1a1a1a] rounded-lg cursor-pointer hover:border-gs-accent/30 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{t.icon}</span>
              <span className="text-[11px] font-bold text-gs-text">{t.title}</span>
            </div>
            <p className="text-[10px] text-gs-dim line-clamp-2 leading-snug">{t.body.split('\n')[0]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// Improvement 8: Post collections/folders
function PostCollections({ collections, onSelectCollection, onCreateCollection, onClose }) {
  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Collections</span>
        <div className="flex items-center gap-2">
          <button onClick={onCreateCollection} className="text-[10px] text-gs-accent bg-transparent border border-gs-accent/30 rounded px-2 py-0.5 cursor-pointer hover:bg-gs-accent/10">+ New</button>
          <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer hover:text-gs-muted">&times;</button>
        </div>
      </div>
      {collections.length === 0 ? (
        <p className="text-[11px] text-gs-faint">No collections yet. Create one to organize saved posts!</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {collections.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectCollection(c)}
              className="text-left p-2.5 bg-[#111] border border-[#1a1a1a] rounded-lg cursor-pointer hover:border-gs-accent/30 transition-colors"
            >
              <div className="text-[11px] font-bold text-gs-text">{c.name}</div>
              <span className="text-[10px] text-gs-faint font-mono">{c.postCount || 0} posts</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Improvement 15: Trending topics sidebar
function TrendingTopicsSidebar({ posts, onTopicClick }) {
  const topics = useMemo(() => {
    const topicMap = {};
    posts.forEach(p => {
      const hashtags = (p.caption || '').match(/#\w+/g) || [];
      hashtags.forEach(tag => {
        const lower = tag.toLowerCase();
        if (!topicMap[lower]) topicMap[lower] = { tag: lower, count: 0, recentPost: p };
        topicMap[lower].count++;
      });
      // Also track artist mentions as topics
      if (p.taggedRecord?.artist) {
        const artistKey = `artist:${p.taggedRecord.artist.toLowerCase()}`;
        if (!topicMap[artistKey]) topicMap[artistKey] = { tag: p.taggedRecord.artist, count: 0, isArtist: true, recentPost: p };
        topicMap[artistKey].count++;
      }
    });
    return Object.values(topicMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [posts]);

  if (topics.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
        <span className="text-[10px] font-bold font-mono text-gs-dim tracking-wider uppercase">Trending Topics</span>
      </div>
      <div className="space-y-1.5">
        {topics.map((t, i) => (
          <button
            key={i}
            onClick={() => onTopicClick?.(t.tag)}
            className="w-full text-left flex items-center gap-2 p-1.5 rounded-lg bg-transparent border-none cursor-pointer hover:bg-[#111] transition-colors"
          >
            <span className="text-[10px] font-extrabold font-mono text-gs-accent w-4">#{i + 1}</span>
            <div className="flex-1 min-w-0">
              <span className={`text-[11px] font-semibold ${t.isArtist ? 'text-gs-muted' : 'text-gs-accent'}`}>
                {t.isArtist ? t.tag : t.tag}
              </span>
            </div>
            <span className="text-[9px] text-gs-faint font-mono">{t.count} post{t.count !== 1 ? 's' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Improvement 16: Community guidelines reminder
function GuidelinesReminder({ onDismiss }) {
  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 mb-4 flex items-start gap-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-blue-400 mb-0.5">Community Guidelines</div>
        <p className="text-[10px] text-blue-300/70 leading-relaxed">
          Be respectful, share your passion for music, and keep discussions constructive. No spam, harassment, or counterfeit sales. Help us keep this community awesome!
        </p>
      </div>
      <button onClick={onDismiss} className="text-blue-400/50 text-xs bg-transparent border-none cursor-pointer hover:text-blue-400 shrink-0">&times;</button>
    </div>
  );
}

// Improvement 11: Suggested posts from non-followed users
function SuggestedPosts({ posts, following, currentUser, onViewUser, onDetail, records }) {
  const suggested = useMemo(() => {
    return posts
      .filter(p => p.user !== currentUser && !following.includes(p.user) && (p.likes || 0) >= 3)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 3);
  }, [posts, following, currentUser]);

  if (suggested.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-bold font-mono text-gs-dim tracking-wider uppercase mb-2.5">Suggested For You</div>
      <div className="space-y-2.5">
        {suggested.map(post => {
          const sp = getProfile(post.user);
          return (
            <div key={post.id} className="flex items-start gap-2.5 p-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
              <div className="cursor-pointer shrink-0" onClick={() => onViewUser(post.user)}>
                <Avatar username={post.user} size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-bold text-gs-text cursor-pointer hover:text-gs-accent" onClick={() => onViewUser(post.user)}>{sp.displayName}</span>
                  <span className="text-[9px] text-gs-faint font-mono">@{post.user}</span>
                </div>
                <p className="text-[10px] text-gs-dim line-clamp-2 leading-snug">{post.caption}</p>
                <div className="flex items-center gap-2 mt-1 text-[9px] text-gs-faint">
                  <span>{post.likes || 0} likes</span>
                  <span>{(post.comments || []).length} comments</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Improvement v3-1: Story creation with timer
function StoryCreator({ onCreateStory, onClose }) {
  const [storyText, setStoryText] = useState('');
  const [duration, setDuration] = useState(24); // hours
  const [bgColor, setBgColor] = useState('#0ea5e9');
  const colors = ['#0ea5e9', '#8b5cf6', '#ef4444', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6'];

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Create Story</span>
        <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer hover:text-gs-muted">&times;</button>
      </div>
      <div className="rounded-xl p-6 mb-3 min-h-[120px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${bgColor}, ${bgColor}88)` }}>
        <textarea
          value={storyText}
          onChange={e => setStoryText(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full bg-transparent border-none text-white text-center text-sm font-bold outline-none resize-none"
          rows={3}
        />
      </div>
      <div className="flex gap-1.5 mb-3">
        {colors.map(c => (
          <button
            key={c}
            onClick={() => setBgColor(c)}
            className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${bgColor === c ? 'border-white scale-110' : 'border-transparent'}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] text-gs-dim font-mono">Expires in:</span>
        {[6, 12, 24, 48].map(h => (
          <button
            key={h}
            onClick={() => setDuration(h)}
            className={`px-2 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors ${duration === h ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim'}`}
          >
            {h}h
          </button>
        ))}
      </div>
      <button
        onClick={() => { onCreateStory?.({ text: storyText, bgColor, duration }); onClose(); }}
        disabled={!storyText.trim()}
        className={`w-full py-2 rounded-lg text-xs font-bold ${storyText.trim() ? 'gs-btn-gradient text-white cursor-pointer' : 'bg-[#1a1a1a] text-gs-dim cursor-default'}`}
      >
        Share Story ({duration}h)
      </button>
    </div>
  );
}

// Improvement v3-2: Story viewer with progress bar
function StoryViewer({ story, onClose, onNext, onPrev, totalStories, currentIndex }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          onNext?.();
          return 0;
        }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [story, onNext]);

  if (!story) return null;

  const sp = getProfile(story.user);

  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto relative">
        {/* Progress bars */}
        <div className="flex gap-1 px-3 pt-3 mb-3">
          {Array.from({ length: totalStories }, (_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{ width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>
        {/* User info */}
        <div className="flex items-center gap-2 px-3 mb-3">
          <Avatar username={story.user} size={28} />
          <span className="text-xs font-bold text-white">{sp.displayName}</span>
          <span className="text-[10px] text-white/50 font-mono">{story.timeAgo || 'now'}</span>
        </div>
        {/* Story content */}
        <div
          className="rounded-xl p-8 min-h-[300px] flex items-center justify-center mx-3"
          style={{ background: `linear-gradient(135deg, ${story.bgColor || '#0ea5e9'}, ${story.bgColor || '#0ea5e9'}88)` }}
        >
          <p className="text-white text-center text-lg font-bold">{story.text || story.caption}</p>
        </div>
        {/* Nav buttons */}
        <button onClick={onPrev} className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-full bg-transparent border-none cursor-pointer" />
        <button onClick={onNext} className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-full bg-transparent border-none cursor-pointer" />
        <button onClick={onClose} className="absolute top-3 right-3 text-white/70 text-lg bg-transparent border-none cursor-pointer hover:text-white">&times;</button>
      </div>
    </div>
  );
}

// Improvement v3-3: Post boost/promote feature
function PostBoostPanel({ post, onBoost, onClose }) {
  const [boostLevel, setBoostLevel] = useState('standard');
  const boostOptions = [
    { id: 'standard', label: 'Standard', reach: '2x', desc: 'Double your post reach', cost: 50 },
    { id: 'enhanced', label: 'Enhanced', reach: '5x', desc: 'Show to genre enthusiasts', cost: 120 },
    { id: 'spotlight', label: 'Spotlight', reach: '10x', desc: 'Featured in trending', cost: 250 },
  ];

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Boost Post</span>
        <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer">&times;</button>
      </div>
      <div className="space-y-2 mb-3">
        {boostOptions.map(opt => (
          <button
            key={opt.id}
            onClick={() => setBoostLevel(opt.id)}
            className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${boostLevel === opt.id ? 'bg-gs-accent/10 border-gs-accent/40' : 'bg-[#111] border-gs-border hover:border-[#333]'}`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold text-gs-text">{opt.label}</span>
              <span className="text-[10px] font-mono text-gs-accent">{opt.reach} reach</span>
            </div>
            <div className="text-[10px] text-gs-dim">{opt.desc}</div>
            <div className="text-[9px] text-amber-400 font-mono mt-1">{opt.cost} pts</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => { onBoost?.(post.id, boostLevel); onClose(); }}
        className="w-full py-2 rounded-lg text-xs font-bold gs-btn-gradient text-white cursor-pointer"
      >
        Boost Now
      </button>
    </div>
  );
}

// Improvement v3-4: Community spotlight feature
function CommunitySpotlight({ posts, onViewUser }) {
  const spotlight = useMemo(() => {
    const userEngagement = {};
    posts.forEach(p => {
      if (!userEngagement[p.user]) userEngagement[p.user] = { user: p.user, posts: 0, likes: 0, comments: 0 };
      userEngagement[p.user].posts++;
      userEngagement[p.user].likes += (p.likes || 0);
      userEngagement[p.user].comments += (p.comments || []).length;
    });
    return Object.values(userEngagement)
      .map(u => ({ ...u, score: u.posts * 3 + u.likes * 2 + u.comments }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [posts]);

  if (spotlight.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/20 rounded-xl p-3 mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span className="text-[10px] font-bold font-mono text-amber-400 tracking-wider uppercase">Community Spotlight</span>
      </div>
      <div className="space-y-2">
        {spotlight.map((s, i) => {
          const sp = getProfile(s.user);
          return (
            <div key={s.user} className="flex items-center gap-2.5 cursor-pointer hover:bg-[#111] rounded-lg p-1.5 -m-1 transition-colors" onClick={() => onViewUser(s.user)}>
              <span className="text-[10px] font-extrabold font-mono text-amber-400 w-4">#{i + 1}</span>
              <Avatar username={s.user} size={24} />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-gs-muted">{sp.displayName}</span>
                <div className="text-[9px] text-gs-faint font-mono">{s.posts} posts / {s.likes} likes</div>
              </div>
              <span className="text-[9px] font-mono text-amber-400">{s.score} pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Improvement v3-5: Post series/thread support
function PostThreadIndicator({ post, posts, onViewThread }) {
  if (!post.threadId) return null;
  const threadPosts = posts.filter(p => p.threadId === post.threadId).sort((a, b) => a.createdAt - b.createdAt);
  const idx = threadPosts.findIndex(p => p.id === post.id);

  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <div className="w-0.5 h-4 bg-gs-accent/30 rounded-full" />
      <span className="text-[9px] font-mono text-gs-accent">
        Thread ({idx + 1}/{threadPosts.length})
      </span>
      <button
        onClick={() => onViewThread?.(post.threadId)}
        className="text-[9px] text-gs-accent/70 bg-transparent border border-gs-accent/20 rounded px-1.5 py-0.5 cursor-pointer hover:bg-gs-accent/10 transition-colors"
      >
        View full thread
      </button>
    </div>
  );
}

// Improvement v3-6: Vinyl challenge of the week
function VinylChallengeOfTheWeek() {
  const challenges = [
    { week: 'This Week', title: 'Deep Cuts Only', desc: 'Share your favorite non-single album track', icon: '🎯', participants: 47 },
    { week: 'Next Week', title: 'First Pressing Friday', desc: 'Show off your oldest first pressing', icon: '💎', participants: 0 },
  ];

  return (
    <div className="bg-gradient-to-r from-violet-500/5 to-transparent border border-violet-500/20 rounded-xl p-3 mb-4">
      <div className="text-[10px] font-bold font-mono text-violet-400 tracking-wider uppercase mb-2.5">Vinyl Challenge of the Week</div>
      {challenges.map((c, i) => (
        <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${i === 0 ? 'bg-violet-500/5 border border-violet-500/10' : 'opacity-50'} ${i > 0 ? 'mt-2' : ''}`}>
          <span className="text-xl">{c.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gs-text">{c.title}</span>
              <span className="text-[8px] font-mono text-gs-faint uppercase">{c.week}</span>
            </div>
            <div className="text-[10px] text-gs-dim">{c.desc}</div>
          </div>
          {c.participants > 0 && (
            <span className="text-[9px] font-mono text-violet-400">{c.participants} joined</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Improvement v3-7: Genre spotlight rotation
function GenreSpotlightRotation({ posts }) {
  const genreData = useMemo(() => {
    const genres = {};
    posts.forEach(p => {
      if (p.taggedRecord?.genre) {
        const g = p.taggedRecord.genre;
        if (!genres[g]) genres[g] = { genre: g, count: 0, topPost: null };
        genres[g].count++;
        if (!genres[g].topPost || (p.likes || 0) > (genres[g].topPost.likes || 0)) genres[g].topPost = p;
      }
    });
    // Also scan hashtags for genre-related mentions
    const genreKeywords = { '#jazz': 'Jazz', '#rock': 'Rock', '#hiphop': 'Hip-Hop', '#electronic': 'Electronic', '#soul': 'Soul', '#funk': 'Funk', '#punk': 'Punk' };
    posts.forEach(p => {
      const hashtags = (p.caption || '').match(/#\w+/g) || [];
      hashtags.forEach(tag => {
        const mapped = genreKeywords[tag.toLowerCase()];
        if (mapped) {
          if (!genres[mapped]) genres[mapped] = { genre: mapped, count: 0, topPost: null };
          genres[mapped].count++;
        }
      });
    });
    return Object.values(genres).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [posts]);

  if (genreData.length === 0) return null;

  const spotlightGenre = genreData[0];

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-bold font-mono text-gs-dim tracking-wider uppercase mb-2">Genre Spotlight</div>
      <div className="flex items-center gap-3 p-2 bg-[#111] rounded-lg border border-[#1a1a1a] mb-2">
        <div className="w-10 h-10 rounded-lg bg-gs-accent/10 flex items-center justify-center text-lg font-bold text-gs-accent">
          {spotlightGenre.genre.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-gs-text">{spotlightGenre.genre}</div>
          <div className="text-[10px] text-gs-dim">{spotlightGenre.count} posts this week</div>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {genreData.slice(1).map(g => (
          <span key={g.genre} className="text-[10px] px-2 py-0.5 rounded-full bg-[#111] border border-gs-border text-gs-muted font-mono">
            {g.genre} ({g.count})
          </span>
        ))}
      </div>
    </div>
  );
}

// Improvement v3-8: User spotlight feature
function UserSpotlight({ posts, currentUser, onViewUser }) {
  const spotlightUser = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const recentPosts = posts.filter(p => p.createdAt >= weekAgo && p.user !== currentUser);
    const userScores = {};
    recentPosts.forEach(p => {
      if (!userScores[p.user]) userScores[p.user] = { user: p.user, posts: 0, totalLikes: 0 };
      userScores[p.user].posts++;
      userScores[p.user].totalLikes += (p.likes || 0);
    });
    const candidates = Object.values(userScores).filter(u => u.posts >= 2);
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => b.totalLikes - a.totalLikes)[0];
  }, [posts, currentUser]);

  if (!spotlightUser) return null;

  const sp = getProfile(spotlightUser.user);

  return (
    <div className="bg-gradient-to-r from-cyan-500/5 to-transparent border border-cyan-500/20 rounded-xl p-3 mb-4">
      <div className="text-[10px] font-bold font-mono text-cyan-400 tracking-wider uppercase mb-2">User of the Week</div>
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewUser(spotlightUser.user)}>
        <Avatar username={spotlightUser.user} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-gs-text">{sp.displayName}</div>
          <div className="text-[10px] text-gs-dim">@{spotlightUser.user}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-cyan-400">{spotlightUser.posts} posts</div>
          <div className="text-[9px] font-mono text-gs-faint">{spotlightUser.totalLikes} likes earned</div>
        </div>
      </div>
    </div>
  );
}

// Improvement v3-9: Post approval workflow for community mods
function ModApprovalQueue({ posts, currentUser, onApprovePost, onRejectPost }) {
  const [showQueue, setShowQueue] = useState(false);
  const pendingPosts = posts.filter(p => p.status === 'pending_review');

  if (pendingPosts.length === 0) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span className="text-[10px] font-bold font-mono text-amber-400 tracking-wider uppercase">Mod Queue ({pendingPosts.length})</span>
        </div>
        <button onClick={() => setShowQueue(!showQueue)} className="text-[10px] text-amber-400 bg-transparent border border-amber-500/30 rounded px-2 py-0.5 cursor-pointer hover:bg-amber-500/10">
          {showQueue ? 'Hide' : 'Review'}
        </button>
      </div>
      {showQueue && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {pendingPosts.map(p => {
            const sp = getProfile(p.user);
            return (
              <div key={p.id} className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar username={p.user} size={20} />
                  <span className="text-[11px] font-bold text-gs-muted">{sp.displayName}</span>
                  <span className="text-[9px] text-gs-faint font-mono">{p.timeAgo}</span>
                </div>
                <p className="text-[10px] text-gs-dim line-clamp-2 mb-2">{p.caption}</p>
                <div className="flex gap-2">
                  <button onClick={() => onApprovePost?.(p.id)} className="px-3 py-1 rounded text-[10px] font-semibold bg-green-500/10 border border-green-500/30 text-green-400 cursor-pointer hover:bg-green-500/20">Approve</button>
                  <button onClick={() => onRejectPost?.(p.id)} className="px-3 py-1 rounded text-[10px] font-semibold bg-red-500/10 border border-red-500/30 text-red-400 cursor-pointer hover:bg-red-500/20">Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Improvement v3-10: Content recommendation explanations
function RecommendationExplanation({ post, following, currentUser }) {
  if (post.user === currentUser || following.includes(post.user)) return null;
  const reasons = [];
  if ((post.likes || 0) >= 10) reasons.push('Popular in the community');
  if (post.taggedRecord) reasons.push(`Based on your interest in ${post.taggedRecord.genre || 'music'}`);
  if ((post.comments || []).length >= 5) reasons.push('Highly discussed');
  if (reasons.length === 0) reasons.push('Suggested for you');

  return (
    <div className="flex items-center gap-1.5 mb-2 px-1">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span className="text-[9px] text-gs-faint font-mono">{reasons[0]}</span>
    </div>
  );
}

// Improvement v3-11: Social feed stats dashboard
function FeedStatsDashboard({ posts, currentUser, onClose }) {
  const stats = useMemo(() => {
    const myPosts = posts.filter(p => p.user === currentUser);
    const totalLikesReceived = myPosts.reduce((s, p) => s + (p.likes || 0), 0);
    const totalCommentsReceived = myPosts.reduce((s, p) => s + (p.comments || []).length, 0);
    const totalLikesGiven = posts.filter(p => p.liked).length;
    const totalBookmarks = posts.filter(p => p.bookmarked).length;
    const topPost = myPosts.sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
    const postsByDay = {};
    myPosts.forEach(p => {
      const day = new Date(p.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
      postsByDay[day] = (postsByDay[day] || 0) + 1;
    });
    return { myPosts: myPosts.length, totalLikesReceived, totalCommentsReceived, totalLikesGiven, totalBookmarks, topPost, postsByDay };
  }, [posts, currentUser]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Feed Stats</span>
        <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer">&times;</button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[#111] rounded-lg p-2.5 text-center">
          <div className="text-lg font-extrabold text-gs-accent">{stats.myPosts}</div>
          <div className="text-[9px] text-gs-faint font-mono">Posts</div>
        </div>
        <div className="bg-[#111] rounded-lg p-2.5 text-center">
          <div className="text-lg font-extrabold text-red-400">{stats.totalLikesReceived}</div>
          <div className="text-[9px] text-gs-faint font-mono">Likes Rcvd</div>
        </div>
        <div className="bg-[#111] rounded-lg p-2.5 text-center">
          <div className="text-lg font-extrabold text-violet-400">{stats.totalCommentsReceived}</div>
          <div className="text-[9px] text-gs-faint font-mono">Comments</div>
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-gs-dim font-mono px-1">
        <span>Likes given: {stats.totalLikesGiven}</span>
        <span>Bookmarks: {stats.totalBookmarks}</span>
      </div>
      {stats.topPost && (
        <div className="mt-2 p-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
          <div className="text-[9px] text-gs-faint font-mono uppercase mb-1">Top Post</div>
          <p className="text-[10px] text-gs-muted line-clamp-1">{stats.topPost.caption}</p>
          <span className="text-[9px] text-gs-accent font-mono">{stats.topPost.likes} likes</span>
        </div>
      )}
    </div>
  );
}

// Improvement v3-12: Post bookmark collections
function BookmarkCollections({ bookmarkedPosts, collections, onMoveToCollection, onCreateCollection, onClose }) {
  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Bookmark Collections</span>
        <div className="flex items-center gap-2">
          <button onClick={onCreateCollection} className="text-[10px] text-gs-accent bg-transparent border border-gs-accent/30 rounded px-2 py-0.5 cursor-pointer hover:bg-gs-accent/10">+ New</button>
          <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer">&times;</button>
        </div>
      </div>
      <div className="space-y-2 mb-3">
        {collections.map(c => (
          <div key={c.id} className="flex items-center justify-between p-2.5 bg-[#111] rounded-lg border border-[#1a1a1a]">
            <div>
              <div className="text-[11px] font-bold text-gs-text">{c.name}</div>
              <span className="text-[9px] text-gs-faint font-mono">{c.postCount || 0} posts</span>
            </div>
          </div>
        ))}
        {collections.length === 0 && (
          <p className="text-[10px] text-gs-faint text-center py-2">No collections yet. Create one to organize bookmarks.</p>
        )}
      </div>
      <div className="text-[10px] text-gs-dim font-mono">{bookmarkedPosts.length} bookmarked post{bookmarkedPosts.length !== 1 ? 's' : ''} total</div>
    </div>
  );
}

// Improvement v3-13: Feed customization wizard
function FeedCustomizationWizard({ onSave, onClose }) {
  const [step, setStep] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState([]);
  const [showNewOnly, setShowNewOnly] = useState(false);

  const genres = ['Rock', 'Jazz', 'Electronic', 'Hip-Hop', 'Metal', 'Pop', 'Punk', 'R&B', 'Soul', 'Folk', 'Classical', 'Funk'];
  const contentTypes = ['Reviews', 'Discussions', 'Photos', 'Trades', 'Polls', 'Events', 'Questions'];

  const toggleGenre = (g) => setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleType = (t) => setSelectedContentTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Customize Your Feed</span>
        <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer">&times;</button>
      </div>
      {/* Step indicators */}
      <div className="flex gap-2 mb-4">
        {['Genres', 'Content', 'Preferences'].map((s, i) => (
          <div key={s} className={`flex-1 text-center py-1 rounded text-[10px] font-mono ${step === i ? 'bg-gs-accent/15 text-gs-accent border border-gs-accent/30' : 'bg-[#111] text-gs-faint border border-gs-border'}`}>
            {s}
          </div>
        ))}
      </div>
      {step === 0 && (
        <div>
          <p className="text-[10px] text-gs-dim mb-2">Select genres you want to see more of:</p>
          <div className="flex flex-wrap gap-1.5">
            {genres.map(g => (
              <button key={g} onClick={() => toggleGenre(g)} className={`px-2.5 py-1 rounded-full text-[10px] font-mono border cursor-pointer transition-colors ${selectedGenres.includes(g) ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
      {step === 1 && (
        <div>
          <p className="text-[10px] text-gs-dim mb-2">What types of posts interest you?</p>
          <div className="flex flex-wrap gap-1.5">
            {contentTypes.map(t => (
              <button key={t} onClick={() => toggleType(t)} className={`px-2.5 py-1 rounded-full text-[10px] font-mono border cursor-pointer transition-colors ${selectedContentTypes.includes(t) ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showNewOnly} onChange={e => setShowNewOnly(e.target.checked)} className="accent-gs-accent w-3.5 h-3.5" />
            <span className="text-[11px] text-gs-muted">Only show posts from the last 7 days</span>
          </label>
          <div className="p-2 bg-[#111] rounded-lg border border-gs-border">
            <div className="text-[10px] text-gs-dim font-mono mb-1">Summary:</div>
            <div className="text-[10px] text-gs-muted">{selectedGenres.length} genres, {selectedContentTypes.length} content types{showNewOnly ? ', recent only' : ''}</div>
          </div>
        </div>
      )}
      <div className="flex justify-between mt-4">
        <button onClick={() => step > 0 ? setStep(step - 1) : onClose()} className="text-[10px] text-gs-dim bg-transparent border border-gs-border rounded px-3 py-1.5 cursor-pointer hover:border-[#333]">
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <button
          onClick={() => step < 2 ? setStep(step + 1) : (() => { onSave?.({ selectedGenres, selectedContentTypes, showNewOnly }); onClose(); })()}
          className="text-[10px] font-semibold gs-btn-gradient text-white rounded px-3 py-1.5 cursor-pointer"
        >
          {step < 2 ? 'Next' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

// Improvement 24: New posts notification bar
function NewPostsBar({ count, onRefresh }) {
  if (!count || count <= 0) return null;
  return (
    <button
      onClick={onRefresh}
      className="w-full py-2.5 mb-3 bg-gs-accent/10 border border-gs-accent/30 rounded-xl text-[12px] font-semibold text-gs-accent cursor-pointer hover:bg-gs-accent/15 transition-colors flex items-center justify-center gap-2"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>
      {count} new post{count !== 1 ? 's' : ''} available
    </button>
  );
}

// Improvement 1: Stories/Highlights section
function StoriesSection({ posts, currentUser, onViewUser, onCreatePost, profile }) {
  // Group recent posts by user as "stories"
  const stories = useMemo(() => {
    const userStories = {};
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // last 24h
    posts.forEach(p => {
      if (p.createdAt >= cutoff && !userStories[p.user]) {
        userStories[p.user] = { user: p.user, post: p, hasMedia: !!p.mediaUrl || !!p.taggedRecord };
      }
    });
    // Put current user first, then others
    const entries = Object.values(userStories);
    const myStory = entries.find(s => s.user === currentUser);
    const others = entries.filter(s => s.user !== currentUser).slice(0, 8);
    return myStory ? [myStory, ...others] : others;
  }, [posts, currentUser]);

  if (stories.length === 0 && !currentUser) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-1 px-1">
      {/* Add story button */}
      <div
        className="flex flex-col items-center gap-1 cursor-pointer shrink-0"
        onClick={onCreatePost}
      >
        <div className="w-14 h-14 rounded-full bg-[#111] border-2 border-dashed border-gs-border flex items-center justify-center hover:border-gs-accent/50 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gs-dim">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <span className="text-[9px] text-gs-dim font-mono">Your Story</span>
      </div>
      {stories.map(s => {
        const sp = getProfile(s.user);
        return (
          <div
            key={s.user}
            className="flex flex-col items-center gap-1 cursor-pointer shrink-0"
            onClick={() => onViewUser(s.user)}
          >
            <div className="w-14 h-14 rounded-full p-0.5" style={{ background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6, #ef4444)' }}>
              <div className="w-full h-full rounded-full bg-gs-bg flex items-center justify-center overflow-hidden">
                <Avatar username={s.user} size={48} src={s.user === currentUser ? profile?.avatarUrl : undefined} />
              </div>
            </div>
            <span className="text-[9px] text-gs-dim font-mono truncate max-w-[56px]">
              {s.user === currentUser ? 'You' : sp.displayName?.split(' ')[0] || s.user}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Trending Hashtags section
function TrendingHashtags({ posts }) {
  const hashtags = useMemo(() => {
    const tagCounts = {};
    posts.forEach(p => {
      const matches = (p.caption || '').match(/#\w+/g);
      if (matches) {
        matches.forEach(tag => {
          const lower = tag.toLowerCase();
          tagCounts[lower] = (tagCounts[lower] || 0) + 1;
        });
      }
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [posts]);

  if (hashtags.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-[10px] font-bold font-mono text-gs-dim tracking-wider uppercase">#Trending</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hashtags.map(([tag, count]) => (
          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#111] border border-gs-border text-gs-muted font-mono cursor-pointer hover:border-gs-accent/30 hover:text-gs-accent transition-colors">
            {tag} <span className="text-gs-faint">({count})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Community Challenges section
function CommunityChallenges() {
  const challenges = [
    { id: 1, title: "Spin Sunday", desc: "Share what you're spinning this Sunday", emoji: "🎵", daysLeft: 3 },
    { id: 2, title: "Crate Dig Challenge", desc: "Find a record under $5 at your local shop", emoji: "📦", daysLeft: 7 },
    { id: 3, title: "Genre Explorer", desc: "Post about a genre you've never explored", emoji: "🌎", daysLeft: 14 },
  ];

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-bold font-mono text-gs-dim tracking-wider uppercase mb-2.5">Community Challenges</div>
      <div className="space-y-2">
        {challenges.map(c => (
          <div key={c.id} className="flex items-center gap-2.5 p-2 bg-[#111] rounded-lg border border-[#1a1a1a] cursor-pointer hover:border-gs-accent/20 transition-colors">
            <span className="text-lg">{c.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-gs-text">{c.title}</div>
              <div className="text-[10px] text-gs-dim truncate">{c.desc}</div>
            </div>
            <span className="text-[9px] text-gs-faint font-mono shrink-0">{c.daysLeft}d left</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Live Listening indicator
function LiveListening({ posts, records, onViewUser }) {
  // Simulate live listeners from recent posts with tagged records
  const listeners = useMemo(() => {
    const cutoff = Date.now() - 30 * 60 * 1000; // last 30 min
    return posts
      .filter(p => p.createdAt >= cutoff && p.taggedRecord)
      .slice(0, 4)
      .map(p => ({
        user: p.user,
        album: p.taggedRecord.album,
        artist: p.taggedRecord.artist,
        profile: getProfile(p.user),
      }));
  }, [posts]);

  if (listeners.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] font-bold font-mono text-gs-dim tracking-wider uppercase">Now Listening</span>
      </div>
      <div className="space-y-2">
        {listeners.map((l, i) => (
          <div
            key={i}
            className="flex items-center gap-2 cursor-pointer hover:bg-[#111] rounded-lg p-1 -m-1 transition-colors"
            onClick={() => onViewUser(l.user)}
          >
            <Avatar username={l.user} size={24} />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-gs-muted">{l.profile.displayName}</span>
              <div className="text-[10px] text-gs-dim truncate">{l.album} - {l.artist}</div>
            </div>
            <div className="flex gap-0.5">
              {[1,2,3].map(b => (
                <div key={b} className="w-0.5 bg-green-500 rounded-full animate-pulse" style={{ height: `${6 + Math.random() * 8}px`, animationDelay: `${b * 0.15}s` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Post Templates quick-access row
function PostTemplates({ onCreatePost }) {
  const templates = [
    { label: "Review", icon: "★", prompt: "Just listened to..." },
    { label: "Trade", icon: "↔", prompt: "Looking to trade..." },
    { label: "Question", icon: "?", prompt: "Does anyone know..." },
    { label: "Poll", icon: "📊", prompt: "Which do you prefer..." },
    { label: "Event", icon: "📅", prompt: "Meetup at..." },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {templates.map(t => (
        <button
          key={t.label}
          onClick={() => onCreatePost?.({ template: t.prompt })}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-[#111] border border-gs-border text-gs-dim cursor-pointer hover:border-gs-accent/30 hover:text-gs-muted transition-colors"
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// Poll display component
function PollDisplay({ post, currentUser, onLikePost }) {
  const [voted, setVoted] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`gs_poll_${post.id}`) || 'null');
    } catch { return null; }
  });

  const options = post.pollOptions || [];
  const totalVotes = options.reduce((sum, o) => sum + (o.votes || 0) + (voted === o.id ? 1 : 0), 0);

  const handleVote = (optionId) => {
    if (voted) return;
    setVoted(optionId);
    localStorage.setItem(`gs_poll_${post.id}`, JSON.stringify(optionId));
  };

  return (
    <div className="space-y-1.5 mb-3">
      {options.map(o => {
        const votes = (o.votes || 0) + (voted === o.id ? 1 : 0);
        const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        return (
          <button
            key={o.id}
            onClick={() => handleVote(o.id)}
            disabled={!!voted}
            className={`w-full text-left px-3 py-2 rounded-lg border text-xs relative overflow-hidden transition-colors ${
              voted === o.id
                ? 'border-gs-accent/40 text-gs-accent'
                : voted
                  ? 'border-gs-border text-gs-muted cursor-default'
                  : 'border-gs-border text-gs-muted cursor-pointer hover:border-gs-accent/30'
            }`}
          >
            {voted && (
              <div
                className="absolute inset-y-0 left-0 bg-gs-accent/10 transition-all"
                style={{ width: `${pct}%` }}
              />
            )}
            <span className="relative z-10 flex justify-between">
              <span>{o.text}</span>
              {voted && <span className="font-mono text-[10px]">{pct}%</span>}
            </span>
          </button>
        );
      })}
      <div className="text-[10px] text-gs-faint font-mono">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</div>
    </div>
  );
}

// Event display component
function EventDisplay({ post }) {
  if (!post.eventDate) return null;
  const eventDate = new Date(post.eventDate);
  const isPast = eventDate < new Date();

  return (
    <div className="bg-[#111] border border-gs-border rounded-xl p-3 mb-3">
      <div className="flex items-center gap-3">
        <div className="text-center shrink-0">
          <div className="text-[10px] font-mono text-gs-accent uppercase">
            {eventDate.toLocaleDateString('en-US', { month: 'short' })}
          </div>
          <div className="text-lg font-extrabold text-gs-text">
            {eventDate.getDate()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-gs-text">{post.eventTitle || 'Vinyl Meetup'}</div>
          {post.eventLocation && (
            <div className="text-[10px] text-gs-dim truncate">{post.eventLocation}</div>
          )}
          <div className="text-[10px] text-gs-faint font-mono">
            {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            {isPast && <span className="ml-1 text-red-400">(Past)</span>}
          </div>
        </div>
        {!isPast && (
          <button className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-gs-accent/15 border border-gs-accent/30 text-gs-accent cursor-pointer hover:bg-gs-accent/25 transition-colors">
            Interested
          </button>
        )}
      </div>
    </div>
  );
}

// Improvement 3: Post Analytics display (enhanced with reach indicator - Improvement 10)
function PostAnalytics({ post }) {
  const views = (post.likes || 0) * 8 + (post.comments || []).length * 12 + Math.floor(Math.random() * 50);
  const engagementRate = views > 0 ? (((post.likes || 0) + (post.comments || []).length) / views * 100).toFixed(1) : '0.0';
  // Improvement 10: Reach indicator
  const reach = Math.floor(views * 1.4 + (post.likes || 0) * 3);
  const reachLevel = reach > 200 ? 'High' : reach > 50 ? 'Medium' : 'Low';
  const reachColor = reach > 200 ? '#22c55e' : reach > 50 ? '#f59e0b' : '#888';

  return (
    <div className="flex items-center gap-3 text-[10px] text-gs-faint font-mono mt-1 flex-wrap">
      <span>{views} views</span>
      <span>{engagementRate}% engagement</span>
      <span style={{ color: reachColor }}>Reach: {reachLevel} ({reach})</span>
    </div>
  );
}

// Improvement 17: Engagement rewards/points display
function EngagementPoints({ post, currentUser }) {
  if (post.user !== currentUser) return null;
  const points = (post.likes || 0) * 2 + (post.comments || []).length * 3 + (post.bookmarked ? 5 : 0);
  if (points === 0) return null;

  return (
    <div className="flex items-center gap-1 text-[10px] font-mono mt-1">
      <span className="text-amber-400">+{points} pts</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </div>
  );
}

// Improvement 12: Post expiration timer display
function ExpirationTimer({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt || !timeLeft) return null;

  return (
    <div className="flex items-center gap-1 text-[9px] font-mono text-orange-400">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      {timeLeft}
    </div>
  );
}

// Improvement 20: Cross-platform share buttons
function CrossPlatformShareButtons({ post, onClose }) {
  const shareUrl = `${window.location.origin}?post=${post.id}`;
  const shareText = post.caption ? post.caption.slice(0, 140) : 'Check this out!';

  const platforms = [
    { name: 'Twitter/X', color: '#1da1f2', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { name: 'Facebook', color: '#1877f2', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { name: 'Reddit', color: '#ff4500', url: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}` },
    { name: 'Email', color: '#888', url: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}` },
  ];

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-gs-card border border-gs-border rounded-xl p-3 shadow-xl z-20 min-w-[160px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold font-mono text-gs-dim uppercase">Share to</span>
        <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer">&times;</button>
      </div>
      <div className="space-y-1">
        {platforms.map(p => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#111] transition-colors text-[11px] font-semibold no-underline"
            style={{ color: p.color }}
          >
            {p.name}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Trending Post Card (compact) ────────────────────────────────────────────
function TrendingCard({ post, rank, onViewUser, onDetail, records }) {
  const p = getProfile(post.user);
  const accent = p.accent || post.accent || "#0ea5e9";
  const matchedRecord = post.taggedRecord
    ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase())
    : null;

  return (
    <div
      className="bg-gs-card border border-gs-border rounded-xl p-3 min-w-[200px] max-w-[220px] shrink-0 cursor-pointer transition-all duration-200 hover:border-[#333] hover:translate-y-[-1px]"
      onClick={() => matchedRecord ? onDetail(matchedRecord) : onViewUser(post.user)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-extrabold font-mono text-gs-accent">#{rank}</span>
        <Avatar username={post.user} size={20} />
        <span className="text-[11px] font-semibold text-gs-muted truncate">{p.displayName}</span>
      </div>
      {post.taggedRecord && (
        <div className="flex items-center gap-2 mb-2">
          <AlbumArt album={post.taggedRecord.album} artist={post.taggedRecord.artist} accent={accent} size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-gs-text truncate">{post.taggedRecord.album}</div>
            <div className="text-[10px] text-gs-dim truncate">{post.taggedRecord.artist}</div>
          </div>
        </div>
      )}
      <p className="text-[11px] text-gs-muted leading-snug line-clamp-2 mb-2">{post.caption}</p>
      <div className="flex items-center gap-3 text-[10px] text-gs-dim">
        <span className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          {post.likes}
        </span>
        <span className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          {(post.comments || []).length}
        </span>
      </div>
    </div>
  );
}

// ── Post Card sub-component ──────────────────────────────────────────────────
function PostCard({ post, currentUser, profile, onLikePost, onCommentPost, onBookmarkPost, onViewUser, onViewArtist, onDetail, records, showAnalytics, density, onPinPost, onRepost, showReportedContent, posts, following, onBoostPost }) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const [showCrossShare, setShowCrossShare] = useState(false);
  const [showCW, setShowCW] = useState(!!post.contentWarning);
  const [showBoost, setShowBoost] = useState(false);
  const inputRef = useRef(null);
  const lastTapRef = useRef(0);

  const p = getProfile(post.user);
  const accent = p.accent || post.accent || "#0ea5e9";

  // Double-tap to like on post images/tagged record
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      if (!post.liked) onLikePost(post.id);
      setDoubleTapHeart(true);
      setTimeout(() => setDoubleTapHeart(false), 800);
    }
    lastTapRef.current = now;
  }, [post.id, post.liked, onLikePost]);

  // Improvement 22: If post is reported and toggle is off, hide it
  if (post.reported && !showReportedContent) return null;

  // Try to find a matching record for the tagged record
  const matchedRecord = post.taggedRecord
    ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase())
    : null;

  const tagAccent = matchedRecord?.accent || accent;

  // Improvement 19: Sentiment
  const sentiment = analyzeSentiment(post.caption);

  // Improvement 18: Auto-hashtag suggestions
  const autoHashtags = suggestHashtags(post.caption, post.taggedRecord);

  const handleComment = () => {
    if (!commentText.trim()) return;
    onCommentPost(post.id, { id: Date.now(), user: currentUser, text: commentText.trim(), time: "just now" });
    setCommentText("");
    setShowCommentInput(false);
  };

  // Share button (copy link)
  const handleShare = () => {
    const url = `${window.location.origin}?post=${post.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setShowShareCopied(true);
    setTimeout(() => setShowShareCopied(false), 1500);
  };

  // Fix: guard against undefined comments array for safety
  const comments = post.comments || [];
  const visibleComments = showAllComments ? comments : comments.slice(-2);
  const postType = inferPostType(post);

  // Scheduling indicator
  const isScheduled = post.scheduledFor && post.scheduledFor > Date.now();

  // Density-based padding
  const paddingClass = density === 'compact' ? 'p-3' : density === 'spacious' ? 'p-7' : 'p-5';

  return (
    <div
      className="bg-gs-card border border-gs-border rounded-2xl overflow-hidden transition-colors duration-200"
      onMouseEnter={e => e.currentTarget.style.borderColor = accent + "33"}
      onMouseLeave={e => e.currentTarget.style.borderColor = ""}
    >
      {/* Accent bar */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />

      {/* v3-10: Content recommendation explanation */}
      <RecommendationExplanation post={post} following={following || []} currentUser={currentUser} />

      {/* v3-5: Post series/thread indicator */}
      <PostThreadIndicator post={post} posts={posts || []} onViewThread={(threadId) => window.alert(`View thread ${threadId}`)} />

      {/* Improvement 5: Pinned post indicator */}
      {post.pinned && (
        <div className="bg-gs-accent/5 border-b border-gs-accent/20 px-5 py-1.5 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gs-accent">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
          <span className="text-[10px] font-mono text-gs-accent">Pinned to profile</span>
        </div>
      )}

      {/* Scheduled indicator */}
      {isScheduled && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-1.5 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="text-[10px] font-mono text-amber-500">
            Scheduled for {new Date(post.scheduledFor).toLocaleString()}
          </span>
        </div>
      )}

      {/* Improvement 13: Anonymous posting indicator */}
      {post.anonymous && (
        <div className="bg-[#111] border-b border-gs-border px-5 py-1.5 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span className="text-[10px] font-mono text-gs-faint">Posted anonymously</span>
        </div>
      )}

      {/* Improvement 22: Reported content warning */}
      {post.reported && (
        <div className="bg-red-500/5 border-b border-red-500/20 px-5 py-1.5 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-[10px] font-mono text-red-400">This post has been reported</span>
        </div>
      )}

      <div className={paddingClass}>
        {/* User header */}
        <div className="flex justify-between items-center mb-4">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => !post.anonymous && onViewUser(post.user)}
          >
            {post.anonymous ? (
              <div className="w-10 h-10 rounded-full bg-[#222] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
            ) : (
              <Avatar username={post.user} size={40} src={post.user === currentUser ? profile?.avatarUrl : undefined} />
            )}
            <div>
              <div className="text-[13px] font-bold text-gs-text">
                {post.anonymous ? 'Anonymous' : p.displayName}
              </div>
              <div className="text-[11px] text-gs-dim font-mono">
                {post.anonymous ? 'anonymous' : `@${post.user}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Improvement 19: Sentiment indicator */}
            <span
              className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full border"
              style={{ color: sentiment.color, borderColor: sentiment.color + '30', background: sentiment.color + '10' }}
              title={`Sentiment: ${sentiment.label}`}
            >
              {sentiment.icon}
            </span>
            {/* Post type badge */}
            <span className={`text-[9px] font-semibold font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#111] border border-[#1a1a1a] ${
              postType === 'polls' ? 'text-violet-400 border-violet-500/20' :
              postType === 'events' ? 'text-emerald-400 border-emerald-500/20' :
              postType === 'trades' ? 'text-amber-400 border-amber-500/20' :
              postType === 'questions' ? 'text-cyan-400 border-cyan-500/20' :
              'text-gs-dim'
            }`}>
              {postType}
            </span>
            {/* Improvement 12: Expiration timer */}
            {post.expiresAt && <ExpirationTimer expiresAt={post.expiresAt} />}
            <span className="text-[10px] text-[#3a3a3a] font-mono">{post.timeAgo}</span>
            {/* Improvement 5: Pin button for own posts */}
            {post.user === currentUser && (
              <button
                onClick={() => onPinPost?.(post.id)}
                className={`bg-transparent border-none cursor-pointer transition-colors ${post.pinned ? 'text-gs-accent' : 'text-gs-faint hover:text-gs-dim'}`}
                title={post.pinned ? 'Unpin post' : 'Pin to profile'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={post.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Improvement 7: Location tag */}
        {post.location && (
          <div className="flex items-center gap-1.5 mb-3 text-[10px] text-gs-dim">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="font-mono">{post.location}</span>
          </div>
        )}

        {/* Improvement 6: Content warning / spoiler tag */}
        {post.contentWarning && showCW && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-[11px] font-bold text-amber-400">Content Warning: {post.contentWarning}</span>
            </div>
            <button
              onClick={() => setShowCW(false)}
              className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-amber-500/15 transition-colors mt-1"
            >
              Show content anyway
            </button>
          </div>
        )}

        {/* Only show main content if no active content warning */}
        {(!post.contentWarning || !showCW) && (
          <>
            {/* Tagged record visual -- larger card redesign */}
            {post.taggedRecord && (
              <div
                onClick={() => matchedRecord && onDetail(matchedRecord)}
                onDoubleClick={handleDoubleTap}
                className="rounded-[16px] p-5 mb-4 flex items-center gap-5 transition-colors duration-200 relative select-none"
                style={{
                  background: `linear-gradient(135deg, ${tagAccent}15, ${tagAccent}08)`,
                  border: `1px solid ${tagAccent}22`,
                  cursor: matchedRecord ? "pointer" : "default",
                }}
                onMouseEnter={e => matchedRecord && (e.currentTarget.style.borderColor = tagAccent + "55")}
                onMouseLeave={e => matchedRecord && (e.currentTarget.style.borderColor = tagAccent + "22")}
              >
                {/* Double-tap heart animation */}
                {doubleTapHeart && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="#ef4444" className="animate-double-tap-heart absolute top-1/2 left-1/2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                )}
                {/* Larger album art */}
                <AlbumArt album={post.taggedRecord.album} artist={post.taggedRecord.artist} accent={tagAccent} size={80} />
                <div className="flex-1 min-w-0">
                  <div className="text-[17px] font-extrabold text-gs-text tracking-tight mb-1">
                    {post.taggedRecord.album}
                  </div>
                  <div className="text-[13px] text-gs-muted mb-1.5">
                    <button onClick={e => { e.stopPropagation(); onViewArtist?.(post.taggedRecord.artist); }} className="bg-transparent border-none text-gs-muted text-[13px] p-0 cursor-pointer hover:text-[#ccc]"
                    >{post.taggedRecord.artist}</button>
                  </div>
                  {matchedRecord && (
                    <div className="flex gap-1.5 items-center flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold font-mono" style={{ background: tagAccent + "18", color: tagAccent }}>
                        {matchedRecord.format} &middot; {matchedRecord.year}
                      </span>
                      {matchedRecord.forSale && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono bg-[#f59e0b18] text-[#f59e0b]">
                          ${matchedRecord.price}
                        </span>
                      )}
                      {/* Marketplace: "Available for Sale" badge on posts with listed records */}
                      {matchedRecord.forSale && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold">FOR SALE</span>
                      )}
                    </div>
                  )}
                  {/* Marketplace: "Buy this record" quick action on review posts */}
                  {matchedRecord?.forSale && (
                    <button
                      onClick={e => { e.stopPropagation(); onDetail(matchedRecord); }}
                      className="mt-2 text-[10px] font-bold px-3 py-1.5 rounded-lg border-none text-black cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ background: `linear-gradient(135deg, ${tagAccent}, #6366f1)` }}
                    >
                      Buy &middot; ${matchedRecord.price}
                    </button>
                  )}
                </div>
                {matchedRecord && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tagAccent} strokeWidth="2" className="shrink-0 opacity-50">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>
            )}

            {/* Caption -- more spacing */}
            <p className="text-sm text-[#ccc] leading-[1.75] mb-4 line-clamp-4">
              {post.caption}
            </p>

            {/* Improvement 18: Auto-hashtag suggestions */}
            {autoHashtags.length > 0 && post.user === currentUser && (
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span className="text-[9px] text-gs-faint font-mono">Suggested:</span>
                {autoHashtags.map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gs-accent/5 border border-gs-accent/15 text-gs-accent/70 font-mono cursor-pointer hover:bg-gs-accent/10 transition-colors">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Poll display */}
            {post.pollOptions && (
              <PollDisplay post={post} currentUser={currentUser} onLikePost={onLikePost} />
            )}

            {/* Event display */}
            {post.eventDate && (
              <EventDisplay post={post} />
            )}

            {/* Media URL image (if provided) -- larger images */}
            {post.mediaUrl && (
              <div
                className="rounded-xl overflow-hidden mb-4 bg-[#111] border border-[#1a1a1a] relative select-none"
                onDoubleClick={handleDoubleTap}
              >
                {doubleTapHeart && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="#ef4444" className="animate-double-tap-heart absolute top-1/2 left-1/2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                )}
                {post.mediaType === "video" ? (
                  <video src={post.mediaUrl} controls className="w-full block" />
                ) : (
                  <img
                    src={post.mediaUrl}
                    /* Improvement 21: Enhanced alt text for accessibility */
                    alt={post.altText || `Shared by ${post.anonymous ? 'anonymous' : post.user}${post.taggedRecord ? ` about ${post.taggedRecord.album} by ${post.taggedRecord.artist}` : ''}${post.caption ? ': ' + post.caption.slice(0, 80) : ''}`}
                    className="w-full block max-h-[360px] sm:max-h-[480px] object-cover"
                    onError={e => e.target.style.display = "none"}
                  />
                )}
                {/* Improvement 21: Alt text badge if present */}
                {post.altText && (
                  <div className="absolute bottom-2 left-2 bg-black/70 rounded px-1.5 py-0.5 text-[9px] text-white font-mono">
                    ALT
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Engagement metrics bar */}
        <div className="flex items-center gap-4 mb-3 text-[11px] text-gs-dim">
          {post.likes > 0 && (
            <span>{post.likes} like{post.likes !== 1 ? 's' : ''}</span>
          )}
          {comments.length > 0 && (
            <span>{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
          )}
          {post.bookmarked && (
            <span className="text-[#f59e0b]">Saved</span>
          )}
          {/* Improvement 4: Repost count */}
          {(post.reposts || 0) > 0 && (
            <span>{post.reposts} repost{post.reposts !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Improvement 3: Post analytics with reach indicator */}
        {showAnalytics && post.user === currentUser && (
          <PostAnalytics post={post} />
        )}

        {/* Improvement 17: Engagement rewards */}
        <EngagementPoints post={post} currentUser={currentUser} />

        {/* Action bar */}
        <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-3">
          <div className="flex gap-5">
            {/* Like */}
            <button
              onClick={() => onLikePost(post.id)}
              className={`flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-xs font-semibold transition-all duration-200 ${post.liked ? 'text-[#ef4444]' : 'text-gs-dim'} ${post.liked ? 'animate-heart-pop' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {post.likes}
            </button>
            {/* Comment */}
            <button
              onClick={() => { setShowCommentInput(s => !s); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-gs-dim text-xs font-semibold"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {comments.length}
            </button>
            {/* Improvement 4: Repost button */}
            <button
              onClick={() => onRepost?.(post.id)}
              className={`flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-xs font-semibold transition-colors ${post.reposted ? 'text-green-400' : 'text-gs-dim hover:text-green-400'}`}
              title="Repost"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
              {post.reposts || 0}
            </button>
            {/* Share button */}
            <div className="relative">
              <button
                onClick={handleShare}
                className="flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-gs-dim text-xs font-semibold hover:text-gs-muted transition-colors relative"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                Share
                {showShareCopied && (
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] text-gs-accent bg-gs-surface border border-gs-border rounded px-2 py-0.5 whitespace-nowrap animate-fade-in">
                    Link copied!
                  </span>
                )}
              </button>
            </div>
            {/* Improvement 20: Cross-platform share */}
            <div className="relative">
              <button
                onClick={() => setShowCrossShare(!showCrossShare)}
                className="flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-gs-dim text-xs font-semibold hover:text-gs-muted transition-colors"
                title="Share to other platforms"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
              {showCrossShare && (
                <CrossPlatformShareButtons post={post} onClose={() => setShowCrossShare(false)} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* v3-3: Boost button (own posts) */}
            {post.user === currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowBoost(!showBoost)}
                  className={`flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-xs font-semibold transition-colors ${showBoost ? 'text-amber-400' : 'text-gs-dim hover:text-amber-400'}`}
                  title="Boost post"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </button>
                {showBoost && (
                  <div className="absolute bottom-full right-0 mb-2 z-20 min-w-[250px]">
                    <PostBoostPanel post={post} onBoost={onBoostPost} onClose={() => setShowBoost(false)} />
                  </div>
                )}
              </div>
            )}
            {/* Bookmark */}
            <button
              onClick={() => onBookmarkPost(post.id)}
              className={`bg-transparent border-none cursor-pointer transition-all duration-200 ${post.bookmarked ? 'text-[#f59e0b]' : 'text-gs-dim'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={post.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Inline comment preview */}
        {comments.length > 0 && (
          <div className="mt-3 border-t border-[#111] pt-2.5">
            {comments.length > 2 && !showAllComments && (
              <button
                onClick={() => setShowAllComments(true)}
                className="bg-transparent border-none text-gs-dim text-xs cursor-pointer mb-2 p-0 font-medium"
              >
                View all {comments.length} comments
              </button>
            )}
            {visibleComments.map(c => {
              const cp = getProfile(c.user);
              return (
                <div key={c.id} className="mb-1.5 text-[13px] leading-normal flex items-baseline gap-1.5">
                  <span
                    onClick={() => onViewUser(c.user)}
                    className="font-bold text-[#e0e0e0] cursor-pointer text-xs shrink-0"
                  >
                    {cp.displayName || c.user}
                  </span>
                  <span className="text-gs-muted flex-1 min-w-0">{c.text}</span>
                  <span className="text-gs-subtle text-[10px] font-mono shrink-0">{c.time}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Comment input */}
        {showCommentInput && (
          <div className="flex gap-2 mt-2.5 items-center">
            <input
              ref={inputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleComment()}
              placeholder="Add a comment..."
              className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[#ccc] text-xs outline-none"
            />
            <button
              onClick={handleComment}
              disabled={!commentText.trim()}
              className={`px-3.5 py-2 border-none rounded-lg font-bold text-[11px] ${commentText.trim() ? 'gs-btn-gradient text-white cursor-pointer' : 'bg-[#1a1a1a] text-gs-dim cursor-default'}`}
            >
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Social Feed Screen ──────────────────────────────────────────────────
const PAGE_SIZE = 6;

export default function SocialFeedScreen({ posts, records, currentUser, following, profile, onCreatePost, onLikePost, onCommentPost, onBookmarkPost, onViewUser, onViewArtist, onDetail }) {
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [q, setQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  // Improvement 25: Feed density toggle
  const [feedDensity, setFeedDensity] = useState(() => {
    try { return localStorage.getItem('gs_feed_density') || 'comfortable'; } catch { return 'comfortable'; }
  });
  // Improvement 9: Drafts
  const [drafts, setDrafts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_drafts') || '[]'); } catch { return []; }
  });
  const [showDrafts, setShowDrafts] = useState(false);
  // Improvement 14: Templates gallery
  const [showTemplatesGallery, setShowTemplatesGallery] = useState(false);
  // Improvement 8: Collections
  const [collections, setCollections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_collections') || '[]'); } catch { return []; }
  });
  const [showCollections, setShowCollections] = useState(false);
  // Improvement 16: Guidelines reminder
  const [showGuidelines, setShowGuidelines] = useState(() => {
    try { return !localStorage.getItem('gs_guidelines_dismissed'); } catch { return true; }
  });
  // Improvement 22: Reported content visibility
  const [showReportedContent, setShowReportedContent] = useState(false);
  // Improvement 24: New posts notification
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [lastSeenPostCount, setLastSeenPostCount] = useState(posts.length);
  // Improvement 23: Pull-to-refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const feedContainerRef = useRef(null);
  const touchStartRef = useRef(0);
  // Improvement 1: Rich composer state
  const [showComposer, setShowComposer] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [showScheduleUI, setShowScheduleUI] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [contentWarningText, setContentWarningText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [expirationHours, setExpirationHours] = useState('');
  const [altText, setAltText] = useState('');
  const composerRef = useRef(null);
  // v3 Improvement states
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [viewingStory, setViewingStory] = useState(null);
  const [storyViewIndex, setStoryViewIndex] = useState(0);
  const [showBoostPanel, setShowBoostPanel] = useState(null);
  const [showFeedStats, setShowFeedStats] = useState(false);
  const [showBookmarkCollections, setShowBookmarkCollections] = useState(false);
  const [showFeedWizard, setShowFeedWizard] = useState(false);

  const sentinelRef = useRef(null);

  // Improvement 24: Track new posts
  useEffect(() => {
    if (posts.length > lastSeenPostCount) {
      setNewPostsCount(posts.length - lastSeenPostCount);
    }
  }, [posts.length, lastSeenPostCount]);

  const handleRefreshPosts = () => {
    setNewPostsCount(0);
    setLastSeenPostCount(posts.length);
    setVisibleCount(PAGE_SIZE);
  };

  // Improvement 25: Save density preference
  const handleDensityChange = (d) => {
    setFeedDensity(d);
    try { localStorage.setItem('gs_feed_density', d); } catch {}
  };

  // Improvement 16: Dismiss guidelines
  const handleDismissGuidelines = () => {
    setShowGuidelines(false);
    try { localStorage.setItem('gs_guidelines_dismissed', '1'); } catch {}
  };

  // Improvement 9: Draft management
  const saveDraft = () => {
    if (!composerText.trim()) return;
    const draft = { caption: composerText, savedAt: Date.now(), scheduledDate, isAnonymous, contentWarning: contentWarningText, location: locationText };
    const updated = [...drafts, draft];
    setDrafts(updated);
    try { localStorage.setItem('gs_drafts', JSON.stringify(updated)); } catch {}
    setComposerText('');
    setShowComposer(false);
  };

  const loadDraft = (draft) => {
    setComposerText(draft.caption || '');
    setScheduledDate(draft.scheduledDate || '');
    setIsAnonymous(draft.isAnonymous || false);
    setContentWarningText(draft.contentWarning || '');
    setLocationText(draft.location || '');
    setShowComposer(true);
    setShowDrafts(false);
  };

  const deleteDraft = (index) => {
    const updated = drafts.filter((_, i) => i !== index);
    setDrafts(updated);
    try { localStorage.setItem('gs_drafts', JSON.stringify(updated)); } catch {}
  };

  // Improvement 8: Collection management
  const createCollection = () => {
    const name = window.prompt('Collection name:');
    if (!name?.trim()) return;
    const updated = [...collections, { id: Date.now(), name: name.trim(), postCount: 0 }];
    setCollections(updated);
    try { localStorage.setItem('gs_collections', JSON.stringify(updated)); } catch {}
  };

  // Improvement 14: Template selection
  const handleSelectTemplate = (template) => {
    setComposerText(template.body);
    setShowComposer(true);
    setShowTemplatesGallery(false);
  };

  // Micro-improvement 9: Virtualized list placeholder for infinite scroll optimization
  const [virtualizedEnabled, setVirtualizedEnabled] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const virtualItemHeight = 280; // estimated post card height
  const virtualBuffer = 5;
  useEffect(() => {
    if (!virtualizedEnabled) return;
    const handleScroll = () => setScrollPosition(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [virtualizedEnabled]);
  const virtualStartIdx = virtualizedEnabled ? Math.max(0, Math.floor(scrollPosition / virtualItemHeight) - virtualBuffer) : 0;
  const virtualEndIdx = virtualizedEnabled ? Math.min(visibleCount, virtualStartIdx + 15 + virtualBuffer * 2) : visibleCount;

  // Micro-improvement 10: Post creation success animation
  const [showPostSuccess, setShowPostSuccess] = useState(false);
  const [postSuccessMessage, setPostSuccessMessage] = useState('');

  // Micro-improvement 11: Feed personalization score display
  const feedPersonalizationScore = useMemo(() => {
    if (!following || following.length === 0) return 0;
    const followingPosts = posts.filter(p => following.includes(p.user)).length;
    const totalPosts = posts.length || 1;
    const followingRatio = Math.round((followingPosts / totalPosts) * 50);
    const interactionScore = Math.min(50, posts.filter(p => p.bookmarked || p.liked).length * 5);
    return Math.min(100, followingRatio + interactionScore);
  }, [posts, following]);

  // Improvement 1: Rich formatting insert
  const handleFormatInsert = (prefix, suffix) => {
    const textarea = composerRef.current;
    if (!textarea) { setComposerText(prev => prev + prefix + suffix); return; }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = composerText.substring(start, end);
    const newText = composerText.substring(0, start) + prefix + selected + suffix + composerText.substring(end);
    setComposerText(newText);
  };

  // Improvement 5: Pin post handler
  const handlePinPost = (postId) => {
    // In a real app this would be an API call; here we just trigger a visual toggle
    // The parent component would handle actual state
    window.alert(`Post ${postId} ${posts.find(p => p.id === postId)?.pinned ? 'unpinned from' : 'pinned to'} your profile!`);
  };

  // Improvement 4: Repost handler
  const handleRepost = (postId) => {
    window.alert(`Post ${postId} reposted to your profile!`);
  };

  // Improvement 23: Pull-to-refresh gesture
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientY - touchStartRef.current;
    if (diff > 100 && window.scrollY <= 0) {
      setIsRefreshing(true);
      handleRefreshPosts();
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  // Enhanced compose submission
  const handleComposerSubmit = () => {
    if (!composerText.trim()) return;
    const postData = {
      caption: composerText.trim(),
      ...(scheduledDate && { scheduledFor: new Date(scheduledDate).getTime() }),
      ...(isAnonymous && { anonymous: true }),
      ...(contentWarningText && { contentWarning: contentWarningText }),
      ...(locationText && { location: locationText }),
      ...(expirationHours && { expiresAt: Date.now() + parseInt(expirationHours) * 3600000 }),
      ...(altText && { altText }),
    };
    onCreatePost?.(postData);
    setComposerText('');
    setScheduledDate('');
    setIsAnonymous(false);
    setContentWarningText('');
    setLocationText('');
    setExpirationHours('');
    setAltText('');
    setShowComposer(false);
    // Micro-improvement 10: Trigger post success animation
    setPostSuccessMessage(scheduledDate ? 'Post scheduled!' : 'Post published!');
    setShowPostSuccess(true);
    setTimeout(() => setShowPostSuccess(false), 2500);
  };

  // Trending: most-liked posts from last 7 days
  const trending = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return [...posts]
      .filter(p => p.createdAt >= weekAgo && p.likes >= 5)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);
  }, [posts]);

  // Saved/bookmarked posts
  const savedPosts = useMemo(() => posts.filter(p => p.bookmarked), [posts]);

  const sorted = useMemo(() => {
    // Saved tab filter
    if (filter === "saved") {
      let filtered = savedPosts;
      if (typeFilter !== "all") {
        filtered = filtered.filter(p => inferPostType(p) === typeFilter);
      }
      if (q) {
        const m = q.toLowerCase();
        filtered = filtered.filter(p =>
          p.caption?.toLowerCase().includes(m) ||
          p.user?.toLowerCase().includes(m) ||
          p.taggedRecord?.album?.toLowerCase().includes(m) ||
          p.taggedRecord?.artist?.toLowerCase().includes(m)
        );
      }
      return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
    }

    let filtered = filter === "following"
      ? posts.filter(p => following.includes(p.user) || p.user === currentUser)
      : posts;

    // Post type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(p => inferPostType(p) === typeFilter);
    }

    // Search filter
    filtered = filtered.filter(p => {
      if (!q) return true;
      const m = q.toLowerCase();
      return (
        p.caption?.toLowerCase().includes(m) ||
        p.user?.toLowerCase().includes(m) ||
        p.taggedRecord?.album?.toLowerCase().includes(m) ||
        p.taggedRecord?.artist?.toLowerCase().includes(m)
      );
    });

    // Sort: pinned posts first, then by createdAt descending
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [posts, filter, typeFilter, following, currentUser, q, savedPosts]);

  // Visible slice for infinite scroll
  const visiblePosts = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = visibleCount < sorted.length;

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, typeFilter, q]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount(prev => prev + PAGE_SIZE);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  // Total likes across visible feed
  const totalFeedLikes = useMemo(() => sorted.reduce((sum, p) => sum + (p.likes || 0), 0), [sorted]);

  // Improvement 17: Total engagement points for current user
  const totalPoints = useMemo(() => {
    return posts
      .filter(p => p.user === currentUser)
      .reduce((sum, p) => sum + (p.likes || 0) * 2 + (p.comments || []).length * 3 + (p.bookmarked ? 5 : 0), 0);
  }, [posts, currentUser]);

  // Density settings
  const densityConfig = FEED_DENSITIES.find(d => d.id === feedDensity) || FEED_DENSITIES[1];

  // v3: Story viewing helpers
  const storyUsers = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const userStories = {};
    posts.forEach(p => {
      if (p.createdAt >= cutoff && !userStories[p.user]) {
        userStories[p.user] = p;
      }
    });
    return Object.values(userStories);
  }, [posts]);

  const handleViewStory = useCallback((user) => {
    const idx = storyUsers.findIndex(s => s.user === user);
    if (idx >= 0) { setViewingStory(storyUsers[idx]); setStoryViewIndex(idx); }
  }, [storyUsers]);

  const handleNextStory = useCallback(() => {
    if (storyViewIndex < storyUsers.length - 1) {
      setStoryViewIndex(storyViewIndex + 1);
      setViewingStory(storyUsers[storyViewIndex + 1]);
    } else {
      setViewingStory(null);
    }
  }, [storyViewIndex, storyUsers]);

  const handlePrevStory = useCallback(() => {
    if (storyViewIndex > 0) {
      setStoryViewIndex(storyViewIndex - 1);
      setViewingStory(storyUsers[storyViewIndex - 1]);
    }
  }, [storyViewIndex, storyUsers]);

  // ── Marketplace: Trending marketplace records for sidebar widget ──
  const trendingMarketplace = useMemo(() => {
    return records
      .filter(r => r.forSale)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 5);
  }, [records]);

  // ── Marketplace: Engagement-to-marketplace conversion tracking ──
  const marketplaceConversions = useMemo(() => {
    const reviewPosts = posts.filter(p => p.taggedRecord);
    const forSaleRecords = records.filter(r => r.forSale);
    const matchCount = reviewPosts.filter(p =>
      forSaleRecords.some(r =>
        r.album.toLowerCase() === (p.taggedRecord?.album || '').toLowerCase() &&
        r.artist.toLowerCase() === (p.taggedRecord?.artist || '').toLowerCase()
      )
    ).length;
    return { total: reviewPosts.length, forSale: matchCount, rate: reviewPosts.length > 0 ? Math.round((matchCount / reviewPosts.length) * 100) : 0 };
  }, [posts, records]);

  // Trending topic click -> set search query
  const handleTopicClick = (topic) => {
    setQ(topic.startsWith('#') ? topic : topic);
  };

  return (
    <div
      className="max-w-[720px] gs-page-transition"
      ref={feedContainerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* v3-2: Story Viewer overlay */}
      {viewingStory && (
        <StoryViewer
          story={viewingStory}
          onClose={() => setViewingStory(null)}
          onNext={handleNextStory}
          onPrev={handlePrevStory}
          totalStories={storyUsers.length}
          currentIndex={storyViewIndex}
        />
      )}

      {/* Improvement 23: Pull-to-refresh indicator */}
      {isRefreshing && (
        <div className="flex justify-center py-3 mb-2">
          <div className="flex items-center gap-2 text-xs text-gs-accent">
            <div className="w-4 h-4 border-2 border-gs-accent/30 border-t-gs-accent rounded-full animate-spin" />
            Refreshing feed...
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tighter text-gs-text mb-1">Social</h1>
            <p className="text-xs text-gs-dim">
              See what the community is spinning
              {totalFeedLikes > 0 && (
                <span className="ml-2 text-gs-accent">
                  &middot; {totalFeedLikes} total likes across {sorted.length} posts
                </span>
              )}
              {/* Improvement 17: Show total points */}
              {totalPoints > 0 && (
                <span className="ml-2 text-amber-400">
                  &middot; {totalPoints} pts earned
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Improvement 22: Reported content toggle */}
            <button
              onClick={() => setShowReportedContent(!showReportedContent)}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showReportedContent ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
              title="Toggle reported content visibility"
            >
              {showReportedContent ? 'Hide Reported' : 'Show Reported'}
            </button>
            {/* Analytics toggle */}
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showAnalytics ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Micro-improvement 10: Post creation success animation */}
      {showPostSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl bg-green-500/90 text-white text-sm font-bold shadow-lg shadow-green-500/30" style={{ animation: 'feedSuccessAnim 0.3s ease-out' }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            {postSuccessMessage}
          </div>
        </div>
      )}

      {/* Micro-improvement 11: Feed personalization score */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-gs-faint uppercase tracking-wider">Feed Personalization:</span>
          <div className="w-16 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${feedPersonalizationScore}%`, background: feedPersonalizationScore >= 60 ? '#22c55e' : feedPersonalizationScore >= 30 ? '#f59e0b' : '#ef4444' }} />
          </div>
          <span className="text-[9px] font-mono" style={{ color: feedPersonalizationScore >= 60 ? '#22c55e' : feedPersonalizationScore >= 30 ? '#f59e0b' : '#ef4444' }}>{feedPersonalizationScore}%</span>
        </div>
        {/* Micro-improvement 9: Virtualized list toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={virtualizedEnabled} onChange={e => setVirtualizedEnabled(e.target.checked)} className="accent-gs-accent w-3 h-3" />
          <span className="text-[9px] text-gs-faint font-mono">Perf mode</span>
        </label>
      </div>

      <style>{`@keyframes feedSuccessAnim { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>

      {/* Improvement 25: Feed density toggle */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[9px] font-mono text-gs-faint uppercase tracking-wider">Density:</span>
        {FEED_DENSITIES.map(d => (
          <button
            key={d.id}
            onClick={() => handleDensityChange(d.id)}
            className={`px-2 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
              feedDensity === d.id
                ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent'
                : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Improvement 16: Community guidelines reminder */}
      {showGuidelines && <GuidelinesReminder onDismiss={handleDismissGuidelines} />}

      {/* Pull-to-refresh hint on mobile */}
      <div className="text-center text-[10px] text-gs-subtle mb-2 sm:hidden">
        Pull down to refresh
      </div>

      {/* Stories section */}
      <StoriesSection
        posts={posts}
        currentUser={currentUser}
        onViewUser={onViewUser}
        onCreatePost={() => setShowComposer(true)}
        profile={profile}
      />

      {/* Live Listening */}
      <LiveListening posts={posts} records={records} onViewUser={onViewUser} />

      {/* v3-1: Story Creator */}
      {showStoryCreator && (
        <StoryCreator onCreateStory={(data) => onCreatePost?.({ ...data, isStory: true })} onClose={() => setShowStoryCreator(false)} />
      )}

      {/* v3-4: Community Spotlight */}
      <CommunitySpotlight posts={posts} onViewUser={onViewUser} />

      {/* v3-6: Vinyl Challenge of the Week */}
      <VinylChallengeOfTheWeek />

      {/* v3-7: Genre Spotlight Rotation */}
      <GenreSpotlightRotation posts={posts} />

      {/* v3-8: User Spotlight */}
      <UserSpotlight posts={posts} currentUser={currentUser} onViewUser={onViewUser} />

      {/* v3-9: Mod Approval Queue */}
      <ModApprovalQueue posts={posts} currentUser={currentUser} onApprovePost={(id) => window.alert(`Post ${id} approved`)} onRejectPost={(id) => window.alert(`Post ${id} rejected`)} />

      {/* v3-11: Feed Stats Dashboard */}
      {showFeedStats && (
        <FeedStatsDashboard posts={posts} currentUser={currentUser} onClose={() => setShowFeedStats(false)} />
      )}

      {/* v3-12: Bookmark Collections */}
      {showBookmarkCollections && (
        <BookmarkCollections bookmarkedPosts={savedPosts} collections={collections} onMoveToCollection={() => {}} onCreateCollection={createCollection} onClose={() => setShowBookmarkCollections(false)} />
      )}

      {/* v3-13: Feed Customization Wizard */}
      {showFeedWizard && (
        <FeedCustomizationWizard onSave={(prefs) => { try { localStorage.setItem('gs_feed_prefs', JSON.stringify(prefs)); } catch {} }} onClose={() => setShowFeedWizard(false)} />
      )}

      {/* Improvement 15: Trending topics sidebar */}
      <TrendingTopicsSidebar posts={posts} onTopicClick={handleTopicClick} />

      {/* Improvement 11: Suggested posts from non-followed users */}
      <SuggestedPosts posts={posts} following={following} currentUser={currentUser} onViewUser={onViewUser} onDetail={onDetail} records={records} />

      {/* Trending section */}
      {trending.length > 0 && !q && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
            <span className="text-xs font-bold text-gs-text">Trending This Week</span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {trending.map((post, i) => (
              <TrendingCard
                key={post.id}
                post={post}
                rank={i + 1}
                onViewUser={onViewUser}
                onDetail={onDetail}
                records={records}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trending Hashtags */}
      <TrendingHashtags posts={posts} />

      {/* Community Challenges toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowChallenges(!showChallenges)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showChallenges ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
        >
          Challenges
        </button>
        {/* Improvement 9: Drafts toggle */}
        <button
          onClick={() => setShowDrafts(!showDrafts)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showDrafts ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
        >
          Drafts{drafts.length > 0 ? ` (${drafts.length})` : ''}
        </button>
        {/* Improvement 14: Templates gallery toggle */}
        <button
          onClick={() => setShowTemplatesGallery(!showTemplatesGallery)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showTemplatesGallery ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
        >
          Templates
        </button>
        {/* Improvement 8: Collections toggle */}
        <button
          onClick={() => setShowCollections(!showCollections)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showCollections ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
        >
          Collections
        </button>
        {/* v3-1: Story Creator toggle */}
        <button
          onClick={() => setShowStoryCreator(!showStoryCreator)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showStoryCreator ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
        >
          Story
        </button>
        {/* v3-11: Feed Stats toggle */}
        <button
          onClick={() => setShowFeedStats(!showFeedStats)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showFeedStats ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
        >
          Stats
        </button>
        {/* v3-12: Bookmark Collections toggle */}
        <button
          onClick={() => setShowBookmarkCollections(!showBookmarkCollections)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showBookmarkCollections ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
        >
          Bookmarks
        </button>
        {/* v3-13: Feed Wizard toggle */}
        <button
          onClick={() => setShowFeedWizard(!showFeedWizard)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showFeedWizard ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
        >
          Customize
        </button>
      </div>
      {showChallenges && <CommunityChallenges />}
      {showDrafts && <DraftsPanel drafts={drafts} onLoadDraft={loadDraft} onDeleteDraft={deleteDraft} onClose={() => setShowDrafts(false)} />}
      {showTemplatesGallery && <PostTemplatesGallery onSelectTemplate={handleSelectTemplate} onClose={() => setShowTemplatesGallery(false)} />}
      {showCollections && <PostCollections collections={collections} onSelectCollection={() => {}} onCreateCollection={createCollection} onClose={() => setShowCollections(false)} />}

      {/* Improvement 24: New posts notification bar */}
      <NewPostsBar count={newPostsCount} onRefresh={handleRefreshPosts} />

      {/* Enhanced Compose prompt (Improvement 1) */}
      {!showComposer ? (
        <div
          onClick={() => setShowComposer(true)}
          className="bg-gs-card border border-gs-border rounded-[14px] px-[18px] py-3.5 flex items-center gap-3 cursor-pointer mb-2 transition-colors duration-200 hover:border-gs-accent/20"
        >
          <Avatar username={currentUser} size={36} src={profile?.avatarUrl} />
          <span className="flex-1 text-[13px] text-gs-dim">What&apos;s spinning?</span>
          <div className="gs-btn-gradient px-4 py-[7px] text-xs text-white">
            Post
          </div>
        </div>
      ) : (
        <div className="bg-gs-card border border-gs-border rounded-[14px] px-[18px] py-4 mb-2">
          <div className="flex items-start gap-3 mb-3">
            <Avatar username={currentUser} size={36} src={profile?.avatarUrl} />
            <div className="flex-1">
              <textarea
                ref={composerRef}
                value={composerText}
                onChange={e => setComposerText(e.target.value)}
                placeholder="What's spinning? Share your thoughts..."
                className="w-full bg-transparent border-none text-[13px] text-[#ccc] outline-none resize-none min-h-[80px] leading-relaxed"
                rows={3}
              />
              {/* Improvement 1: Rich formatting toolbar */}
              <RichFormatToolbar onInsert={handleFormatInsert} />
            </div>
          </div>

          {/* Composer options row */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {/* Improvement 2: Schedule toggle */}
            <button
              onClick={() => setShowScheduleUI(!showScheduleUI)}
              className={`px-2 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors ${showScheduleUI ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-[#111] border-gs-border text-gs-dim hover:border-gs-accent/30'}`}
            >
              Schedule
            </button>
            {/* Improvement 13: Anonymous toggle */}
            <button
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={`px-2 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors ${isAnonymous ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'bg-[#111] border-gs-border text-gs-dim hover:border-gs-accent/30'}`}
            >
              {isAnonymous ? 'Anonymous: ON' : 'Anonymous'}
            </button>
            {/* Improvement 6: Content warning toggle */}
            <button
              onClick={() => setContentWarningText(contentWarningText ? '' : 'Spoiler')}
              className={`px-2 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors ${contentWarningText ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-[#111] border-gs-border text-gs-dim hover:border-gs-accent/30'}`}
            >
              CW
            </button>
            {/* Improvement 12: Expiration option */}
            <select
              value={expirationHours}
              onChange={e => setExpirationHours(e.target.value)}
              className="px-2 py-1 rounded text-[10px] font-mono bg-[#111] border border-gs-border text-gs-dim cursor-pointer outline-none"
            >
              <option value="">No expiry</option>
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
            </select>
            {/* Improvement 9: Save draft button */}
            <button
              onClick={saveDraft}
              className="px-2 py-1 rounded text-[10px] font-mono bg-[#111] border border-gs-border text-gs-dim cursor-pointer hover:border-gs-accent/30 transition-colors"
            >
              Save Draft
            </button>
          </div>

          {/* Improvement 2: Schedule UI */}
          {showScheduleUI && (
            <SchedulePostUI
              scheduledDate={scheduledDate}
              onScheduleChange={setScheduledDate}
              onClear={() => { setScheduledDate(''); setShowScheduleUI(false); }}
            />
          )}

          {/* Improvement 6: Content warning input */}
          {contentWarningText !== '' && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-amber-400 font-mono">CW:</span>
              <input
                value={contentWarningText}
                onChange={e => setContentWarningText(e.target.value)}
                placeholder="Content warning label..."
                className="flex-1 bg-[#111] border border-amber-500/20 rounded px-2 py-1 text-[11px] text-amber-200 outline-none"
              />
            </div>
          )}

          {/* Improvement 7: Location input */}
          <div className="flex items-center gap-2 mt-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" className="shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <input
              value={locationText}
              onChange={e => setLocationText(e.target.value)}
              placeholder="Add location (optional)"
              className="flex-1 bg-transparent border-none text-[11px] text-gs-dim outline-none"
            />
          </div>

          {/* Improvement 21: Alt text input for images */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] text-gs-faint font-mono shrink-0">ALT:</span>
            <input
              value={altText}
              onChange={e => setAltText(e.target.value)}
              placeholder="Image alt text for accessibility (optional)"
              className="flex-1 bg-transparent border-none text-[11px] text-gs-dim outline-none"
            />
          </div>

          {/* Improvement 18: Auto-suggested hashtags preview */}
          {composerText.length > 10 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[9px] text-gs-faint font-mono">Suggested tags:</span>
              {suggestHashtags(composerText, null).map(tag => (
                <button
                  key={tag}
                  onClick={() => setComposerText(prev => prev + ' ' + tag)}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-gs-accent/5 border border-gs-accent/15 text-gs-accent/70 font-mono cursor-pointer hover:bg-gs-accent/10 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Submit row */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gs-border">
            <button
              onClick={() => { setShowComposer(false); setComposerText(''); }}
              className="text-[11px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {scheduledDate && (
                <span className="text-[9px] text-amber-400 font-mono">
                  Scheduled: {new Date(scheduledDate).toLocaleDateString()}
                </span>
              )}
              <button
                onClick={handleComposerSubmit}
                disabled={!composerText.trim()}
                className={`px-4 py-[7px] rounded-lg text-xs font-bold ${composerText.trim() ? 'gs-btn-gradient text-white cursor-pointer' : 'bg-[#1a1a1a] text-gs-dim cursor-default'}`}
              >
                {scheduledDate ? 'Schedule' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post templates row */}
      <div className="mb-4">
        <PostTemplates onCreatePost={(data) => {
          if (data?.template) {
            setComposerText(data.template);
            setShowComposer(true);
          } else {
            onCreatePost?.(data);
          }
        }} />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-dim" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search posts, users, albums, artists..."
          className="w-full bg-gs-card border border-gs-border rounded-[10px] py-2.5 pr-3.5 pl-9 text-[#f0f0f0] text-[13px] outline-none font-sans focus:border-gs-accent/30"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#222] border-none cursor-pointer text-gs-muted text-xs flex items-center justify-center hover:bg-[#333]"
          >
            &times;
          </button>
        )}
      </div>

      {/* Filter tabs: All / Following / Saved */}
      <div className="flex border-b border-[#1a1a1a] mb-3">
        {[
          { id: "all", label: "All Posts" },
          { id: "following", label: "Following" },
          { id: "saved", label: `Saved${savedPosts.length > 0 ? ` (${savedPosts.length})` : ''}` },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-5 py-2.5 bg-transparent border-none border-b-2 text-[13px] font-semibold cursor-pointer -mb-px transition-colors duration-150 ${
              filter === f.id
                ? 'border-b-gs-accent text-gs-accent'
                : 'border-b-transparent text-gs-dim'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Post type filter pills */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {POST_TYPE_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setTypeFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all duration-150 cursor-pointer ${
              typeFilter === f.id
                ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent'
                : 'bg-transparent border-[#222] text-gs-dim hover:border-[#333] hover:text-gs-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Marketplace: Trending in Marketplace sidebar widget ── */}
      {trendingMarketplace.length > 0 && (
        <div className="bg-gs-card border border-gs-border rounded-xl p-3.5 mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold font-mono text-gs-dim tracking-wider uppercase">Trending in Marketplace</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gs-accent/10 text-gs-accent/60 font-mono">Shop</span>
          </div>
          <div className="space-y-2">
            {trendingMarketplace.map((r, i) => (
              <div key={r.id} onClick={() => onDetail(r)} className="flex items-center gap-2.5 cursor-pointer group">
                <span className="text-[10px] text-gs-faint font-mono w-4 text-right">{i + 1}</span>
                <div className="w-8 h-8 rounded overflow-hidden shrink-0" style={{ background: r.accent || '#333' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-gs-text truncate group-hover:text-gs-accent transition-colors">{r.album}</div>
                  <div className="text-[9px] text-gs-faint truncate">{r.artist}</div>
                </div>
                <span className="text-[11px] font-bold text-gs-text shrink-0">${r.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Marketplace: Engagement-to-marketplace conversion display ── */}
      {showAnalytics && marketplaceConversions.total > 0 && (
        <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
          <div className="text-[10px] font-mono text-gs-dim tracking-wider uppercase mb-2">Post to Marketplace Conversions</div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-gs-accent">{marketplaceConversions.rate}%</div>
              <div className="text-[9px] text-gs-faint">conversion rate</div>
            </div>
            <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full bg-gs-accent rounded-full" style={{ width: `${marketplaceConversions.rate}%` }} />
            </div>
            <div className="text-[9px] text-gs-dim font-mono">
              {marketplaceConversions.forSale}/{marketplaceConversions.total} posts linked to listings
            </div>
          </div>
        </div>
      )}

      {/* Posts */}
      {sorted.length === 0 ? (
        <Empty
          icon={filter === "saved" ? "&#128278;" : q ? "&#128269;" : "&#128221;"}
          text={
            filter === "saved"
              ? "No saved posts yet. Bookmark posts to see them here!"
              : q
                ? `No posts matching "${q}"`
                : "No posts yet. Be the first to share what you're listening to!"
          }
        />
      ) : (
        <div className={`flex flex-col ${densityConfig.gap}`}>
          {visiblePosts.map((post, idx) => (
            <div key={post.id}>
              <PostCard
                post={post}
                currentUser={currentUser}
                profile={profile}
                onLikePost={onLikePost}
                onCommentPost={onCommentPost}
                onBookmarkPost={onBookmarkPost}
                onViewUser={onViewUser}
                onViewArtist={onViewArtist}
                onDetail={onDetail}
                records={records}
                showAnalytics={showAnalytics}
                density={feedDensity}
                onPinPost={handlePinPost}
                onRepost={handleRepost}
                showReportedContent={showReportedContent}
                posts={posts}
                following={following}
                onBoostPost={(postId, level) => window.alert(`Post ${postId} boosted to ${level}!`)}
              />
              {/* Marketplace: Promoted marketplace post — appears after 3rd post, clearly marked */}
              {idx === 2 && trendingMarketplace.length > 0 && (
                <div className="bg-gs-card border border-gs-border rounded-2xl overflow-hidden mt-3">
                  <div className="h-0.5 bg-gradient-to-r from-amber-500/50 to-transparent" />
                  <div className="px-5 py-1.5 flex items-center gap-2 border-b border-gs-border bg-amber-500/3">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    <span className="text-[9px] font-mono text-amber-500/80">Promoted &middot; Marketplace</span>
                  </div>
                  <div className="p-4">
                    <div className="text-[11px] text-gs-dim mb-2">Records the community is talking about</div>
                    <div className="flex gap-2.5 overflow-x-auto pb-1">
                      {trendingMarketplace.slice(0, 3).map(r => (
                        <div key={r.id} onClick={() => onDetail(r)} className="shrink-0 flex gap-2 items-center bg-[#111] rounded-lg px-3 py-2 cursor-pointer hover:bg-[#1a1a1a] transition-colors border border-transparent hover:border-gs-accent/20" style={{ minWidth: 180 }}>
                          <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={36} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold text-gs-text truncate">{r.album}</div>
                            <div className="text-[9px] text-gs-faint truncate">{r.artist}</div>
                            <div className="text-[10px] font-bold text-gs-text mt-0.5">${r.price}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />

          {/* Loading indicator */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-xs text-gs-dim">
                <div className="w-4 h-4 border-2 border-gs-accent/30 border-t-gs-accent rounded-full animate-spin" />
                Loading more posts...
              </div>
            </div>
          )}

          {!hasMore && sorted.length > PAGE_SIZE && (
            <div className="text-center text-[11px] text-gs-faint py-4 font-mono">
              You&apos;ve seen all {sorted.length} posts
            </div>
          )}
        </div>
      )}

      {/* Floating "New Post" action button (mobile) */}
      <button
        onClick={() => setShowComposer(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full gs-btn-gradient flex items-center justify-center shadow-xl shadow-gs-accent/30 z-[80] sm:hidden"
        aria-label="New Post"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  );
}
