/** One place for every training term the app explains on tap, so the wording stays the same everywhere. */
export const GLOSSARY = {
  readiness: { term: "Readiness", text: "A 0–100 score from today's check-in (sleep, energy, soreness, stress, HRV). It adjusts today's weights: 75+ progress as planned, 50–74 hold weights, under 50 cut targets by 10%." },
  confidence: { term: "Confidence", text: "How much of the check-in the readiness score is based on. Six inputs is high; two or three is low, so treat the score as a rough guide." },
  rir: { term: "RIR", text: "Reps in reserve: how many more reps you could have done before failing. 2 RIR means you stopped with 2 left in the tank." },
  e1rm: { term: "e1RM", text: "Estimated one-rep max: the most you could lift once, worked out from the weight and reps you logged. No need to actually test it." },
  deload: { term: "Deload", text: "A lighter week (about 60% of your usual sets, same weights) that lets built-up fatigue clear so you come back stronger." },
  plateau: { term: "Plateau", text: "A lift whose e1RM hasn't gone up in 3 sessions. The app suggests one change to get it moving again." },
  fatigue: { term: "Fatigue %", text: "How much recent training a muscle is still recovering from. Above 60% means it's still worked; it roughly halves every 48 hours." },
  halfLife: { term: "T½ 48 h", text: "Half-life: fatigue in a muscle drops by about half every 48 hours of rest." },
  workingSets: { term: "Working sets", text: "The hard sets that count toward progress. Warm-up sets aren't included." },
  dots: { term: "DOTS", text: "A score that adjusts strength for body weight and sex, so lifters of different sizes can be compared fairly." },
  tdee: { term: "TDEE", text: "Total daily energy expenditure: about how many calories you burn in a day, including training. BMR is the part you'd burn at complete rest." },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
