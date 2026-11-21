// Share something to the Spotters feed: always to the local feed, and to friends when "Share workouts" is on.
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useUI } from "@/App";
import { toFeedPost } from "@/lib/feedPosts";
import type { FeedPost } from "@/lib/types";

export function useFeedShare() {
  const { set } = useStore();
  const auth = useAuth();
  const ui = useUI();
  return (draft: Omit<FeedPost, "id" | "author" | "likes" | "comments">) => {
    const post = toFeedPost(draft);
    set((s) => (s.feed.some((p) => p.sessionId && p.sessionId === post.sessionId) ? s : { ...s, feed: [post, ...s.feed] }));
    if (auth.live && !auth.viewing && auth.me?.shareFeed) {
      const { likes: _l, comments: _c, author: _a, id: _i, ts: _t, ...body } = post;
      api("POST", "/api/posts", { kind: "session", body }).catch(() => ui.toast("Saved, but couldn't post to Spotters"));
    }
  };
}
