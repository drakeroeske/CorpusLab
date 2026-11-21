/** One place for every training term the app explains on tap, so the wording stays the same everywhere. */
export const GLOSSARY = {
  readiness: { term: "Readiness", text: "A 0–100 score from today's check-in (sleep, energy, soreness, stress, HRV) and your training over the last 2 days compared with usual. It adjusts today's weights: 75+ HIGH, progress as planned; 50–74 MODERATE, hold weights; under 50 LOW, cut targets by 10%." },
  confidence: { term: "Confidence", text: "How much of the check-in the readiness score is based on. Six or seven inputs is high; three or fewer is low, so treat the score as a rough guide." },
  rir: { term: "RIR", text: "Reps in reserve: how many more reps you could have done before failing. 2 RIR means you stopped with 2 left in the tank." },
  e1rm: { term: "e1RM", text: "Estimated one-rep max: the most you could lift once, worked out from the weight and reps you logged. No need to actually test it." },
  deload: { term: "Deload", text: "A lighter week (about 60% of your usual sets, same weights) that lets built-up fatigue clear so you come back stronger." },
  plateau: { term: "Plateau", text: "A lift trained in the last 2 weeks whose estimated max hasn't gone up in 3 sessions. The app suggests one change to get it moving again. During a fat-loss phase, holding strength is the goal, so only a lift that's clearly dropping (about 5% off its recent best) is flagged." },
  fatigue: { term: "Fatigue %", text: "How much recent training a muscle is still recovering from. Above 60% means it's still worked; it roughly halves every 48 hours." },
  halfLife: { term: "48 h", aria: "recovery half-life", text: "Recovery half-life: fatigue in a muscle drops by about half every 48 hours of rest. Poor sleep or missed protein slows it down." },
  workingSets: { term: "Working sets", text: "The hard sets that count toward progress. Warm-up sets aren't included." },
  dots: { term: "DOTS", text: "A score that adjusts strength for body weight and sex, so lifters of different sizes can be compared fairly." },
  tdee: { term: "Maintenance (TDEE)", text: "About how many calories you burn in a day, including training: the intake that keeps your weight steady. Estimated as resting burn (BMR, Mifflin–St Jeor) × an activity factor for your lifting days, plus calories from runs, rides, classes and WODs you log (4-week average). You can enter your own number in Profile instead." },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
