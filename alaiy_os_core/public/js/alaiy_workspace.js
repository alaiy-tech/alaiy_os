/**
 * AlaiyOS Workspace Content Loader
 *
 * Intercepts workspace card, shortcut, AND sidebar link clicks for AlaiyOS
 * users using a capture-phase listener (fires before Frappe's bubble-phase
 * jQuery handlers).  Instead of navigating to a DocType page, renders a
 * list → form view inside an overlay within the main-content area of the
 * workspace.  The sidebar stays visible; the URL updates to /desk/os/<slug>.
 *
 * Route stays within /desk/os throughout.  Direct loads at /desk/os/<slug>
 * are handled by route_guard.js (stores slug → redirect to workspace) and
 * then by the page-change listener below (opens the overlay).
 *
 * Depends on (loaded before this file):
 *   constants/roles.js          — ALAIY_OS_ROUTE, ALAIY_OS_WORKSPACE
 *   constants/workspace_config.js — ALAIY_LABEL_TO_DOCTYPE, ALAIY_SKIP_LABELS
 *   alaiy_ui.js                 — updateAlaiyTitle()
 */

frappe.provide("alaiy_os.workspace");

const AW = alaiy_os.workspace;
AW._overlay = null;
AW._doctype = null;
AW._inited = false;

// ── URL helpers ───────────────────────────────────────────────────────────────
function _labelToSlug(str) {
  return (str || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function _osUrl(slug) {
  return `${ALAIY_OS_ROUTE}${slug ? "/" + slug : ""}`;
}
function _isOsPath(path) {
  if (!path) return false;

  return path === `${ALAIY_OS_ROUTE}` || path.startsWith(`${ALAIY_OS_ROUTE}/`);
}

// Click interceptor applies to all desk users inside the OS workspace.

// ── Label extraction ──────────────────────────────────────────────────────────
function _labelFrom(el) {
  const dl = el.getAttribute && el.getAttribute("data-label");
  if (dl && dl.trim()) return dl.trim();

  const selectors = [
    ".link-item-label",
    ".widget-title",
    ".shortcut-widget-box .widget-head .widget-title",
    ".item-name",
    ".sidebar-item-label",
    "span",
  ];
  for (const sel of selectors) {
    const child = el.querySelector(sel);
    if (child && child.textContent) {
      const t = child.textContent.trim().split("\n")[0].trim();
      if (t) return t;
    }
  }
  return (el.textContent || "").trim().split("\n")[0].trim();
}

// ── Overlay management ────────────────────────────────────────────────────────
AW._ensureOverlay = function () {
  const ws = document.querySelector(
    ".layout-main-section, .layout-main-section-wrapper, .workspace-container, .page-content",
  );

  if (!ws) return null;

  const existing = document.getElementById("alaiy-ws-content");

  if (existing) {
    AW._overlay = existing;
    return existing;
  }

  const el = document.createElement("div");
  el.id = "alaiy-ws-content";

  if (getComputedStyle(ws).position === "static") {
    ws.style.position = "relative";
  }

  ws.appendChild(el);
  AW._overlay = el;

  return el;
};

AW.close = function () {
  if (AW._overlay) {
    AW._overlay.classList.remove("visible");
  }

  AW._doctype = null;

  history.pushState({}, "", `${ALAIY_OS_ROUTE}`);

  if (typeof updateAlaiyTitle === "function") {
    updateAlaiyTitle("Dashboard");
  }
};

// ── Open by slug (used when resolving /desk/os/<slug> deep links) ───────────
AW.openBySlug = function (slug) {
  for (const label of Object.keys(ALAIY_LABEL_TO_DOCTYPE)) {
    if (_labelToSlug(label) === slug) {
      AW.openList(ALAIY_LABEL_TO_DOCTYPE[label], label);
      return;
    }
  }
  for (const [label, doctype] of Object.entries(ALAIY_LABEL_TO_DOCTYPE)) {
    if (_labelToSlug(doctype) === slug) {
      AW.openList(doctype, label);
      return;
    }
  }
};

// ── List view ─────────────────────────────────────────────────────────────────
AW.openList = function (doctype, label) {
  AW._doctype = doctype;

  const slug = _labelToSlug(label || doctype);

  if (window.location.pathname !== _osUrl(slug)) {
    history.pushState({}, "", _osUrl(slug));
  }
  const overlay = AW._ensureOverlay();
  if (!overlay) return;

  overlay.className = "alaiy-ws-content visible";
  overlay.innerHTML = "";

  const header = document.createElement("div");
  header.className = "alaiy-ws-header";
  header.innerHTML =
    '<button class="alaiy-ws-back">← Back</button>' +
    '<span class="alaiy-ws-title">' +
    (label || doctype) +
    "</span>" +
    '<button class="btn btn-primary btn-sm alaiy-ws-new">＋ New</button>';
  overlay.appendChild(header);

  header.querySelector(".alaiy-ws-back").addEventListener("click", AW.close);
  header.querySelector(".alaiy-ws-new").addEventListener("click", function () {
    AW._newForm(doctype, label);
  });

  const body = document.createElement("div");
  body.className = "alaiy-ws-body";
  overlay.appendChild(body);

  AW._renderList(body, doctype, label);
  if (typeof updateAlaiyTitle === "function")
    updateAlaiyTitle(label || doctype);
};

AW._renderList = function (body, doctype, label) {
  body.innerHTML = '<div class="alaiy-ws-loading">Loading…</div>';

  frappe.call({
    method: "frappe.client.get_list",
    args: {
      doctype: doctype,
      fields: ["name", "modified"],
      limit_page_length: 100,
      order_by: "modified desc",
    },
    callback: function (r) {
      body.innerHTML = "";
      const rows = (r && r.message) || [];

      if (!rows.length) {
        body.innerHTML =
          '<div class="alaiy-ws-empty">No records. Click <strong>＋ New</strong> to create one.</div>';
        return;
      }

      const tbl = document.createElement("table");
      tbl.className = "alaiy-ws-table";
      tbl.innerHTML =
        "<thead><tr><th>Name</th><th>Last Modified</th></tr></thead>";
      const tb = document.createElement("tbody");

      rows.forEach(function (row) {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        td1.textContent = row.name;
        const td2 = document.createElement("td");
        td2.textContent = frappe.datetime.str_to_user(row.modified);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.addEventListener("click", function () {
          AW._openForm(body, doctype, row.name, label);
        });
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      body.appendChild(tbl);
    },
    error: function () {
      body.innerHTML =
        '<div class="text-danger" style="padding:20px">Could not load ' +
        doctype +
        ".</div>";
    },
  });
};

// ── Form view ─────────────────────────────────────────────────────────────────
AW._openForm = function (body, doctype, docname, label) {
  body.innerHTML =
    '<button class="btn btn-sm btn-default alaiy-ws-back" style="margin:16px 0 12px">' +
    "← Back to list</button>" +
    '<div class="alaiy-ws-form-host"></div>';

  body.querySelector(".alaiy-ws-back").addEventListener("click", function () {
    AW._renderList(body, doctype, label);
  });

  AW._mountForm(body.querySelector(".alaiy-ws-form-host"), doctype, docname);
};

AW._newForm = function (doctype) {
  frappe.new_doc(doctype);
};

AW._mountForm = function (host, doctype, docname) {
  host.innerHTML = '<div class="alaiy-ws-loading">Loading form…</div>';

  frappe.model.with_doctype(doctype, function () {
    frappe.model.with_doc(doctype, docname, function () {
      host.innerHTML = "";
      const FormClass = frappe.ui && frappe.ui.form && frappe.ui.form.Form;
      if (typeof FormClass !== "function") {
        host.innerHTML =
          '<div class="text-danger" style="padding:20px">Form renderer unavailable.</div>';
        return;
      }
      try {
        const form = new FormClass(doctype, host, false);
        form.refresh(docname);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[AlaiyOS workspace] form render:", e);
        host.innerHTML =
          '<div class="text-warning" style="padding:20px">Could not render form: ' +
          (e.message || e) +
          ".</div>";
      }
    });
  });
};

// ── Capture-phase click interceptor ──────────────────────────────────────────
AW._onCapture = function (e) {
  // (applies to all users on the OS workspace)
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return;
  }

  const path = window.location.pathname;
  if (!_isOsPath(path)) return;

  if (e.target.closest && e.target.closest("#alaiy-ws-content")) return;

  const target = e.target.closest
    ? e.target.closest(
        ".link-item, .workspace-link-item, .shortcut-widget-box, " +
          ".workspace-shortcut-card, [data-doctype], " +
          ".standard-sidebar-item, .workspace-sidebar-item, " +
          ".sidebar-item-container",
      )
    : null;
  if (!target) return;

  const label = _labelFrom(target);
  if (!label || ALAIY_SKIP_LABELS.has(label)) return;

  const doctype =
    ALAIY_LABEL_TO_DOCTYPE[label] ||
    (target.getAttribute && target.getAttribute("data-doctype")) ||
    null;
  if (!doctype) return;

  e.preventDefault();
  e.stopPropagation();
  AW.openList(doctype, label);
};

// ── Sub-route recovery: open overlay after workspace loads ────────────────────
// route_guard.js stores a pending slug in sessionStorage when Frappe fires
// a route change for /desk/os/<slug>.  We read it here once the workspace page
// has rendered and open the appropriate overlay.
$(document).on("page-change", function () {
  const path = window.location.pathname;
  if (!_isOsPath(path)) return;

  const slug = sessionStorage.getItem("alaiy_pending_subroute");
  if (!slug) return;
  sessionStorage.removeItem("alaiy_pending_subroute");
  setTimeout(function () {
    AW.openBySlug(slug);
  }, 350);
});

// ── Init ──────────────────────────────────────────────────────────────────────
AW.init = function () {
  if (AW._inited) return;
  AW._inited = true;
  document.addEventListener("click", AW._onCapture, true);
};

$(document).on("app_ready", function () {
  AW.init();
});
