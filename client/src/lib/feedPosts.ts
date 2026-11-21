// Feed posts for things that aren't lifting workouts: runs, rides, classes, WODs, and reached goals.
// They go out as the existing "session" post kind with a `type` in the body, so the server and database need no
// change, and older app versions still show them as a titled post.
import type { Activity, FeedPost, PersonalGoal, Units } from "./types";
import { ACTIVITY, activitySummary, activityTitle, fmtDistance, fmtDuration } from "./activities";
import { goalTitle } from "./goals";
import { newId } from "./exercises";

type Draft = Omit<FeedPost, "id" | "author" | "likes" | "comments">;

export function activityPost(a: Activity, units: Units): Draft {
  const big = a.type === "wod" && a.wod
    ? (a.wod.format === "for_time" ? fmtDuration(a.durationSec) : a.wod.format === "amrap" ? `AMRAP ${Math.round(a.durationSec / 60)}` : a.wod.format === "emom" ? `EMOM ${Math.round(a.durationSec / 60)}` : `${Math.round(a.durationSec / 60)} MIN`)
    : a.distanceKm ? fmtDistance(a.distanceKm, a.type, units).toUpperCase() : `${Math.round(a.durationSec / 60)} MIN`;
  return {
    type: "activity", ts: a.start + a.durationSec * 1000, sessionId: a.id,
    sessionName: activityTitle(a), durationMin: Math.round(a.durationSec / 60), topSets: [], prs: [],
    headline: big, detail: activitySummary(a, units), badge: ACTIVITY[a.type].label.toUpperCase(),
  };
}

/** Bodyweight goals post without numbers: friends see that you reached it, not what you weigh. */
export function goalPost(g: PersonalGoal, units: Units, ts = Date.now()): Draft {
  const title = g.kind === "bodyweight" ? "Reached a bodyweight goal" : goalTitle(g, units);
  return {
    type: "goal", ts, sessionId: `goal:${g.id}`, sessionName: "Goal reached", durationMin: 0, topSets: [], prs: [],
    headline: "GOAL", detail: title, badge: "GOAL REACHED",
  };
}

export const toFeedPost = (d: Draft): FeedPost => ({ ...d, id: newId("post"), author: "me", likes: [], comments: [] });
