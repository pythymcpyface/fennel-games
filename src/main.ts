import "@carbon/styles/css/styles.css";
import "./styles.css";
import { applyCarbonTheme } from "./kit/carbon-setup.ts";
import { Hub } from "./hub/hub.ts";
import { GAMES } from "./hub/registry.ts";
import { detectPlatform, resolveAdapter } from "./kit/composition-root.ts";

async function main(): Promise<void> {
  applyCarbonTheme("g100");
  const root = document.getElementById("app");
  if (!root) throw new Error("missing #app");
  try {
    const adapter = await resolveAdapter(detectPlatform());
    new Hub(adapter, GAMES, root).start();
  } catch (err) {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "hub-error";
    p.setAttribute("role", "alert");
    p.textContent = "The app could not start.";
    root.append(p);
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

void main();
