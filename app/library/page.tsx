"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../ui/app-shell";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { usePlayerData } from "../../lib/use-player-data";
import { InstructionVideo, parseInstructionVideo } from "../../src/components/library/InstructionVideo";

type Item = {
  id: string;
  code: string;
  item_type: "golf_drill" | "vector_exercise" | "swing_movement";
  title: string;
  category: string;
  stage: string | null;
  purpose: string;
  setup: string | null;
  instructions: string | null;
  intention: string | null;
  dosage: string | null;
  pass_criterion: string | null;
  equipment: string | null;
  progression: string | null;
  regression: string | null;
  status: "draft" | "approved" | "retired";
  version: number;
  source_reference: string;
  media_url: string | null;
  instruction_complete: boolean;
};
type Editable = Omit<Item, "id" | "version" | "instruction_complete">;
const blank: Editable = {
  code: "",
  item_type: "golf_drill",
  title: "",
  category: "",
  stage: "",
  purpose: "",
  setup: "",
  instructions: "",
  intention: "",
  dosage: "",
  pass_criterion: "",
  equipment: "",
  progression: "",
  regression: "",
  source_reference: "Coach library",
  media_url: "",
  status: "draft",
};
const fields: Array<[keyof Editable, string, "input" | "textarea"]> = [
  ["purpose", "Purpose", "textarea"],
  ["setup", "Setup / starting position", "textarea"],
  ["instructions", "How to perform it", "textarea"],
  ["intention", "Intention / feel", "textarea"],
  ["dosage", "Dose", "input"],
  ["pass_criterion", "Success check", "textarea"],
  ["equipment", "Equipment", "input"],
  ["progression", "Progression", "textarea"],
  ["regression", "Regression", "textarea"],
];

export default function LibraryPage() {
  const { profile } = usePlayerData();
  const [items, setItems] = useState<Item[]>([]),
    [query, setQuery] = useState(""),
    [type, setType] = useState<"all" | Item["item_type"]>("all"),
    [form, setForm] = useState<Editable>(blank),
    [editingId, setEditingId] = useState(""),
    [edit, setEdit] = useState<Editable>(blank),
    [message, setMessage] = useState("");
  const canEdit = profile?.role === "coach" || profile?.role === "admin";
  const load = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const { data, error } = await sb
      .from("library_items")
      .select(
        "id,code,item_type,title,category,stage,purpose,setup,instructions,intention,dosage,pass_criterion,equipment,progression,regression,status,version,source_reference,media_url,instruction_complete",
      )
      .order("code");
    if (error) setMessage(error.message);
    else setItems((data || []) as Item[]);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (type === "all" || i.item_type === type) &&
          `${i.code} ${i.title} ${i.category} ${i.purpose}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [items, type, query],
  );
  const startEdit = (item: Item) => {
    setEditingId(item.id);
    setEdit({
      code: item.code,
      item_type: item.item_type,
      title: item.title,
      category: item.category,
      stage: item.stage || "",
      purpose: item.purpose,
      setup: item.setup || "",
      instructions: item.instructions || "",
      intention: item.intention || "",
      dosage: item.dosage || "",
      pass_criterion: item.pass_criterion || "",
      equipment: item.equipment || "",
      progression: item.progression || "",
      regression: item.regression || "",
      source_reference: item.source_reference,
      media_url: item.media_url || "",
      status: item.status,
    });
  };
  const saveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabaseBrowserClient();
    if (!sb || !canEdit) return;
    if (form.media_url && !parseInstructionVideo(form.media_url)) {
      setMessage("Use a valid YouTube or Vimeo video link.");
      return;
    }
    const { data, error } = await sb
      .from("library_items")
      .insert({ ...form, code: null, media_url: form.media_url || null, created_by: profile?.id })
      .select("code")
      .single();
    setMessage(error ? error.message : `${data?.code || "Library item"} created and saved as a draft.`);
    if (!error) {
      setForm(blank);
      await load();
    }
  };
  const saveEdit = async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !canEdit || !editingId) return;
    if (edit.media_url && !parseInstructionVideo(edit.media_url)) {
      setMessage("Use a valid YouTube or Vimeo video link.");
      return;
    }
    const { error } = await sb
      .from("library_items")
      .update({ ...edit, media_url: edit.media_url || null })
      .eq("id", editingId);
    setMessage(
      error
        ? error.message
        : "Instructions updated and a version snapshot retained.",
    );
    if (!error) {
      setEditingId("");
      await load();
    }
  };
  const instructionFields = (
    value: Editable,
    setter: (next: Editable) => void,
  ) => (
    <div className="instruction-fields">
      {fields.map(([key, label, kind]) => (
        <label key={key}>
          {label}
          {kind === "textarea" ? (
            <textarea
              value={String(value[key] || "")}
              onChange={(e) => setter({ ...value, [key]: e.target.value })}
            />
          ) : (
            <input
              value={String(value[key] || "")}
              onChange={(e) => setter({ ...value, [key]: e.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  );

  return (
    <AppShell active="library">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Package 7E.4.1 · Instruction framework</p>
          <h1>Drill &amp; Vector library</h1>
          <p>
            Every assigned item should explain the setup, the movement, the
            intention, the dose and how the player checks success.
          </p>
        </div>
      </header>
      <section className="library-summary">
        <div>
          <strong>
            {items.filter((i) => i.item_type === "golf_drill").length}
          </strong>
          <span>Golf-drill routes</span>
        </div>
        <div>
          <strong>
            {items.filter((i) => i.item_type === "vector_exercise").length}
          </strong>
          <span>Vector exercises</span>
        </div>
        <div>
          <strong>{items.filter((i) => !i.instruction_complete).length}</strong>
          <span>Instructions to complete</span>
        </div>
      </section>
      <section className="library-tools">
        <input
          aria-label="Search library"
          placeholder="Search code, title, category or purpose"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter item type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="all">All content</option>
          <option value="golf_drill">Golf drills</option>
          <option value="vector_exercise">Vector exercises</option>
          <option value="swing_movement">Swing movements</option>
        </select>
      </section>
      {message && (
        <div className="success-banner" role="status">
          {message}
        </div>
      )}
      <div className="library-layout">
        <section className="library-list" aria-label="Library items">
          {filtered.map((item) => (
            <article
              className={`library-card ${editingId === item.id ? "editing" : ""}`}
              key={item.id}
            >
              <div className="library-code">
                <span>{item.code}</span>
                <small>
                  v{item.version} · {item.status}
                </small>
                <b
                  className={
                    item.instruction_complete ? "complete" : "incomplete"
                  }
                >
                  {item.instruction_complete
                    ? "Player ready"
                    : "Needs instructions"}
                </b>
              </div>
              <div>
                <p className="eyebrow">
                  {item.item_type === "golf_drill"
                    ? "Golf drill"
                    : item.item_type === "vector_exercise"
                      ? "Vector exercise"
                      : "Swing movement"}{" "}
                  · {item.category}
                </p>
                <h2>{item.title}</h2>
                <p>{item.purpose}</p>
                {item.media_url && <InstructionVideo url={item.media_url} title={item.title} />}
                {editingId !== item.id && (
                  <details className="library-instructions">
                    <summary>View instructions</summary>
                    <dl>
                      <div>
                        <dt>Setup</dt>
                        <dd>{item.setup || "Not yet written"}</dd>
                      </div>
                      <div>
                        <dt>How to do it</dt>
                        <dd className="preserve-lines">
                          {item.instructions || "Not yet written"}
                        </dd>
                      </div>
                      <div>
                        <dt>Intention</dt>
                        <dd>{item.intention || "Not yet written"}</dd>
                      </div>
                      <div>
                        <dt>Dose</dt>
                        <dd>{item.dosage || "Not yet written"}</dd>
                      </div>
                      <div>
                        <dt>Success check</dt>
                        <dd>{item.pass_criterion || "Not yet written"}</dd>
                      </div>
                      {item.progression && (
                        <div>
                          <dt>Progression</dt>
                          <dd>{item.progression}</dd>
                        </div>
                      )}
                      {item.regression && (
                        <div>
                          <dt>Regression</dt>
                          <dd>{item.regression}</dd>
                        </div>
                      )}
                    </dl>
                  </details>
                )}
                {editingId === item.id && (
                  <div className="inline-editor">
                    {instructionFields(edit, setEdit)}
                    <label>
                      YouTube or Vimeo link
                      <input type="url" value={edit.media_url || ""} onChange={(e) => setEdit({ ...edit, media_url: e.target.value })} />
                    </label>
                    <label>
                      Status
                      <select
                        value={edit.status}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            status: e.target.value as Item["status"],
                          })
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="approved">Approved</option>
                        <option value="retired">Retired</option>
                      </select>
                    </label>
                    <div className="editor-actions">
                      <button onClick={() => setEditingId("")}>Cancel</button>
                      <button className="primary-action" onClick={saveEdit}>
                        Save instructions
                      </button>
                    </div>
                  </div>
                )}
                <small className="source-line">
                  Source: {item.source_reference}
                </small>
              </div>
              {canEdit && editingId !== item.id && (
                <button className="edit-item" onClick={() => startEdit(item)}>
                  Edit instructions
                </button>
              )}
            </article>
          ))}
          {!filtered.length && (
            <div className="empty-state compact">
              <h2>No matching items</h2>
              <p>Adjust the search or import the library seed files.</p>
            </div>
          )}
        </section>
        {canEdit && (
          <aside className="library-editor">
            <p className="eyebrow">Coach only</p>
            <h2>Add library item</h2>
            <p>
              New items remain drafts until approved. Instruction completeness
              is calculated automatically.
            </p>
            <form onSubmit={saveNew}>
              <div className="generated-code-note"><strong>Code generated automatically</strong><span>Vector assigns the next code when this draft is saved.</span></div>
              <label>
                Title
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label>
                Category
                <input
                  required
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </label>
              <label>
                Stage
                <input
                  value={form.stage || ""}
                  onChange={(e) => setForm({ ...form, stage: e.target.value })}
                />
              </label>
              <label>
                Type
                <select
                  value={form.item_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      item_type: e.target.value as Item["item_type"],
                    })
                  }
                >
                  <option value="golf_drill">Golf drill</option>
                  <option value="vector_exercise">Vector exercise</option>
                  <option value="swing_movement">Swing movement</option>
                </select>
              </label>
              {instructionFields(form, setForm)}
              <label>
                YouTube or Vimeo link
                <input type="url" placeholder="https://vimeo.com/…" value={form.media_url || ""} onChange={(e) => setForm({ ...form, media_url: e.target.value })} />
              </label>
              <label>
                Source reference
                <input
                  required
                  value={form.source_reference}
                  onChange={(e) =>
                    setForm({ ...form, source_reference: e.target.value })
                  }
                />
              </label>
              <button className="primary-action">Save draft</button>
            </form>
          </aside>
        )}
      </div>
    </AppShell>
  );
}
