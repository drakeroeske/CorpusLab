import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "./lib/install";
import { captureInvite } from "./lib/invite";

registerSW();
captureInvite();

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
