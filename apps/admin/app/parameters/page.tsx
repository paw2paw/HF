import React from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";

type SearchParams = Record<string, string | string[] | undefined>;

function asString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function normalize(v: string) {
  return String(v || "").trim();
}

function fmtDate(v: any) {
  try {
    if (!v) return "—";
    const d = typeof v === "string" ? new Date(v) : v;
    if (Number.isNaN(d?.getTime?.())) return "—";
    // Stable UTC display (no locale mismatch)
    return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch {
    return "—";
  }
}

/* ---------------- Server Action: Update row ---------------- */

async function updateParameter(formData: FormData) {
  "use server";

  const returnTo = normalize(String(formData.get("returnTo") || "/parameters"));
  const parameterId = normalize(String(formData.get("parameterId") || ""));
  if (!parameterId) redirect(returnTo);

  await prisma.parameter.update({
    where: { parameterId },
    data: {
      name: normalize(String(formData.get("name") || "")),
      domainGroup: normalize(String(formData.get("domainGroup") || "")),
      sectionId: normalize(String(formData.get("sectionId") || "")),
      scaleType: normalize(String(formData.get("scaleType") || "")),
      directionality: normalize(String(formData.get("directionality") || "")),
      computedBy: normalize(String(formData.get("computedBy") || "")),
      definition: normalize(String(formData.get("definition") || "")),
    },
  });

  revalidatePath("/parameters");
  redirect(returnTo);
}

/* ---------------- Sortable header cell ---------------- */

function SortTH({
  label,
  field,
  sort,
  dir,
  q,
}: {
  label: string;
  field: string;
  sort: string;
  dir: string;
  q: string;
}) {
  const active = sort === field;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const arrow = active ? (dir === "asc" ? "▲" : "▼") : "";

  const href = `/parameters?q=${encodeURIComponent(q)}&sort=${encodeURIComponent(
    field
  )}&dir=${encodeURIComponent(nextDir)}`;

  return (
    <th
      className={[
        "p-0",
        "whitespace-nowrap",
        "bg-slate-200",
        "text-slate-900",
        "border-b border-slate-300",
        "border-r border-slate-300",
      ].join(" ")}
    >
      <a
        href={href}
        className={[
          "block w-full",
          "px-4 py-3",
          "text-xs font-semibold",
          "hover:bg-slate-300/60",
          "focus:outline-none focus:ring-4 focus:ring-slate-200",
        ].join(" ")}
        title={`Sort by ${label}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span>{label}</span>
          <span className="text-[10px] opacity-80">{arrow}</span>
        </span>
      </a>
    </th>
  );
}

function PlainTH({ label, last }: { label: string; last?: boolean }) {
  return (
    <th
      className={[
        "px-4 py-3",
        "text-left text-xs font-semibold",
        "whitespace-nowrap",
        "bg-slate-200",
        "text-slate-900",
        "border-b border-slate-300",
        !last ? "border-r border-slate-300" : "",
      ].join(" ")}
    >
      {label}
    </th>
  );
}

export default async function ParametersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) || {};
  const q = normalize(asString(sp.q));
  const sortRaw = normalize(asString(sp.sort) || "createdAt");
  const dirRaw = normalize(asString(sp.dir) || "desc");

  // Single-column sort only + whitelist
  const sortable = new Set([
    "createdAt",
    "parameterId",
    "name",
    "domainGroup",
    "sectionId",
    "scaleType",
  ]);
  const sort = sortable.has(sortRaw) ? sortRaw : "createdAt";
  const dir = dirRaw === "asc" ? "asc" : "desc";

  const where: any = {};
  if (q) {
    where.OR = [
      { parameterId: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { definition: { contains: q, mode: "insensitive" } },
      { domainGroup: { contains: q, mode: "insensitive" } },
      { sectionId: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy: any[] = [{ [sort]: dir }];
  if (sort !== "createdAt") orderBy.push({ createdAt: "desc" });

  const rows = await prisma.parameter.findMany({
    where,
    orderBy,
    take: 500,
  });

  const returnTo = `/parameters?q=${encodeURIComponent(q)}&sort=${encodeURIComponent(
    sort
  )}&dir=${encodeURIComponent(dir)}`;

  // High-contrast inputs (does NOT rely on dark mode)
  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100";

  return (
    <div className="px-6 py-6 max-w-[1800px]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Parameters</h1>
        <div className="text-sm text-slate-600 mt-1">{rows.length} parameters</div>
      </div>

      {/* Search */}
      <form method="GET" className="mb-4">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search id, name, definition…"
          className="w-[560px] max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        />
      </form>

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-slate-300 bg-white shadow-sm">
        <table className="min-w-[1750px] w-full border-collapse text-xs">
          {/* Column sizing */}
          <colgroup>
            {/* select */}
            <col style={{ width: "56px" }} />
            {/* status */}
            <col style={{ width: "130px" }} />
            {/* created */}
            <col style={{ width: "210px" }} />
            {/* id */}
            <col style={{ width: "140px" }} />
            {/* name */}
            <col style={{ width: "300px" }} />
            {/* domain */}
            <col style={{ width: "210px" }} />
            {/* section */}
            <col style={{ width: "190px" }} />
            {/* type */}
            <col style={{ width: "160px" }} />
            {/* direction */}
            <col style={{ width: "180px" }} />
            {/* computed */}
            <col style={{ width: "190px" }} />
            {/* definition */}
            <col style={{ width: "620px" }} />
            {/* actions */}
            <col style={{ width: "120px" }} />
          </colgroup>

          <thead className="sticky top-0 z-10">
            <tr>
              <SortTH label="Created" field="createdAt" {...{ sort, dir, q }} />
              <SortTH label="ID" field="parameterId" {...{ sort, dir, q }} />
              <SortTH label="Name" field="name" {...{ sort, dir, q }} />
              <SortTH label="Domain" field="domainGroup" {...{ sort, dir, q }} />
              <SortTH label="Section" field="sectionId" {...{ sort, dir, q }} />
              <SortTH label="Type" field="scaleType" {...{ sort, dir, q }} />
              <PlainTH label="Direction" />
              <PlainTH label="Computed" />
              <PlainTH label="Definition" last />
            </tr>
          </thead>

          <tbody>
            {rows.map((p, idx) => {
              const zebra = idx % 2 === 0 ? "bg-white" : "bg-slate-50";
              const formId = `row-${p.parameterId}`;

              return (
                <tr
                  key={p.parameterId}
                  className={[
                    zebra,
                    "hover:bg-slate-100",
                    "border-b border-slate-200",
                    "text-slate-900",
                  ].join(" ")}
                >
                  <td className="px-4 py-2 border-r border-slate-200 whitespace-nowrap text-slate-700">
                    {fmtDate(p.createdAt)}
                  </td>

                  <td className="px-4 py-2 border-r border-slate-200 whitespace-nowrap font-mono">
                    {p.parameterId}
                  </td>

                  <td className="px-4 py-2 border-r border-slate-200">
                    {/* One form per row */}
                    <form id={formId} className="rowUpdateForm" action={updateParameter}>
                      <input type="hidden" name="parameterId" value={p.parameterId} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
                    </form>

                    <span className="rowSaveStatus mb-1 block text-[11px] font-semibold text-slate-500" aria-live="polite" />

                    <input name="name" form={formId} defaultValue={p.name || ""} className={inputCls} />
                  </td>

                  <td className="px-4 py-2 border-r border-slate-200">
                    <input name="domainGroup" form={formId} defaultValue={p.domainGroup || ""} className={inputCls} />
                  </td>

                  <td className="px-4 py-2 border-r border-slate-200">
                    <input name="sectionId" form={formId} defaultValue={p.sectionId || ""} className={inputCls} />
                  </td>

                  <td className="px-4 py-2 border-r border-slate-200">
                    <input name="scaleType" form={formId} defaultValue={p.scaleType || ""} className={inputCls} />
                  </td>

                  <td className="px-4 py-2 border-r border-slate-200">
                    <input
                      name="directionality"
                      form={formId}
                      defaultValue={p.directionality || ""}
                      className={inputCls}
                    />
                  </td>

                  <td className="px-4 py-2 border-r border-slate-200">
                    <input name="computedBy" form={formId} defaultValue={p.computedBy || ""} className={inputCls} />
                  </td>

                  <td className="px-4 py-2">
                    <input name="definition" form={formId} defaultValue={p.definition || ""} className={inputCls} />
                  </td>
                </tr>
              );
            })}

            {!rows.length ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-600">
                  No parameters found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Inline autosave (no SSR data-dirty attribute -> no hydration mismatch) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function () {
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function qs(sel, root) { return (root || document).querySelector(sel); }

  function isDirty(input) {
    var base = (input.defaultValue || '');
    return input.value !== base;
  }

  // Important: remove the attribute entirely when not dirty (avoids empty data-dirty="")
  function applyDirtyAttr(input) {
    if (isDirty(input)) input.setAttribute('data-dirty', '1');
    else input.removeAttribute('data-dirty');
  }

  function setStatus(form, msg) {
    var cell = form && form.parentElement;
    if (!cell) return;
    var status = qs('.rowSaveStatus', cell);
    if (!status) return;
    status.textContent = msg || '';
  }

  function submitForm(form) {
    if (!form) return;
    setStatus(form, 'Saving…');
    try {
      form.requestSubmit();
    } catch (e) {
      var hiddenSubmit = qs('button[type="submit"]', form);
      if (hiddenSubmit) hiddenSubmit.click();
      else form.submit();
    }
  }

  var inputs = qsa('input[form]');
  inputs.forEach(function (input) {
    var formId = input.getAttribute('form');
    if (!formId) return;
    var form = document.getElementById(formId);
    if (!form) return;

    // Initial state (client-side only; server does not render data-dirty)
    applyDirtyAttr(input);

    input.addEventListener('input', function () {
      applyDirtyAttr(input);
      if (isDirty(input)) setStatus(form, 'Edited');
      else setStatus(form, '');
    });

    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      applyDirtyAttr(input);
      if (isDirty(input)) submitForm(form);
    });

    input.addEventListener('blur', function () {
      applyDirtyAttr(input);
      if (isDirty(input)) submitForm(form);
    });
  });
})();
          `,
        }}
      />
    </div>
  );
}