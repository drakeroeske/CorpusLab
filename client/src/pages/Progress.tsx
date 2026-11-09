import { useUI } from "@/App";
import { EngineHeader } from "@/components/riso";
import { Sectioned, type Section } from "@/components/Sections";
import { FatigueView, TrendsView, Vault } from "./Body";
import { Experiments, History, LabReport } from "./Train";

const SECTIONS: Section[] = [
  { id: "fatigue", label: "Body" },
  { id: "trends", label: "Trends" },
  { id: "history", label: "History" },
  { id: "lab", label: "Lab report", title: "Weekly lab report", more: true, hint: "How sleep, food and lifts connected this week" },
  { id: "experiments", label: "Experiments", more: true, hint: "Test one habit for 4 weeks and see if it helps" },
  { id: "vault", label: "Photos", title: "Photos & measurements", more: true, hint: "Private progress photos and tape measurements" },
];

/** Everything about how you're changing over time: recovery, trends, past workouts, plus reports and photos under More. */
export default function Progress() {
  const ui = useUI();
  return (
    <div>
      <EngineHeader title="Progress" />
      <Sectioned name="Progress" sections={SECTIONS} value={ui.sub.progress ?? "fatigue"} onChange={(s) => ui.setSub("progress", s)}
        render={(id) => (
          id === "trends" ? <TrendsView />
            : id === "history" ? <History />
            : id === "lab" ? <LabReport />
            : id === "experiments" ? <Experiments />
            : id === "vault" ? <Vault />
            : <FatigueView />
        )} />
    </div>
  );
}
