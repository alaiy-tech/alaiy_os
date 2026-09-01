import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { AskAlaiyLauncher } from "./askAlaiy/AskAlaiyLauncher";
import { useAskAlaiy } from "./askAlaiy/useAskAlaiy";
import "./askAlaiy/styles.css";

/**
 * The whole widget's mount point. app_include_js drops this bundle on every
 * Desk page as a plain <script> -- there's no bundler-level integration with
 * Desk's own (also-vanilla-JS) app, so this owns its own DOM node and its
 * own React root entirely outside Desk's tree.
 *
 * Guarded against: running before `frappe` exists (app_include_js scripts
 * execute after core Desk JS, but this is cheap insurance), a Guest session
 * (the login page, before anyone is signed in), and double-mounting (Desk is
 * an SPA -- this script only executes once per real page load, but the guard
 * costs nothing and protects against a future include-list change that adds
 * it twice by accident).
 */
function Root() {
  const chat = useAskAlaiy();
  const [open, setOpen] = useState(false);
  return <AskAlaiyLauncher open={open} onOpenChange={setOpen} chat={chat} />;
}

function mount() {
  if (typeof frappe === "undefined" || !frappe.session || frappe.session.user === "Guest") return;
  if (document.getElementById("ask-alaiy-widget-root")) return;

  const el = document.createElement("div");
  el.id = "ask-alaiy-widget-root";
  document.body.appendChild(el);

  createRoot(el).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
