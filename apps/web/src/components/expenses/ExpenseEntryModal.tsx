import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExpenseDto } from "@office/types";
import { EXPENSE_CATEGORIES } from "@office/types";
import { apiDownload, apiViewInNewTab } from "../../apiClient";
import { EXPENSE_CURRENCIES } from "../../constants/expenseCurrencies";
import { DEV_DEPARTMENTS, DEV_DEPARTMENT_SUGGESTIONS } from "../../constants/departments";
import { useApi } from "../../useApi";
import { FormModal } from "../modals/FormModal";

type Mode = "create" | "edit";

function defaultDate() {
  return new Date().toISOString().slice(0, 10);
}

export type ExpenseEntryModalProps = {
  opened: boolean;
  onClose: () => void;
  mode: Mode;
  /** Required when mode is "edit" */
  expenseId: string | null;
};

export function ExpenseEntryModal({ opened, onClose, mode, expenseId }: ExpenseEntryModalProps) {
  const uid = useId();
  const p = `exp-mod-${uid}`;
  const { request, uploadExpenseReceipt } = useApi();
  const qc = useQueryClient();
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(EXPENSE_CURRENCIES[0]);
  const [department, setDepartment] = useState<string>(DEV_DEPARTMENTS[0]);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [expenseDate, setExpenseDate] = useState(defaultDate);
  const [pendingReceipt, setPendingReceipt] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const itemQuery = useQuery({
    queryKey: ["expense", expenseId],
    enabled: opened && mode === "edit" && Boolean(expenseId),
    queryFn: async () => {
      const res = await request(`/api/expenses/${expenseId}`);
      if (!res.ok) throw new Error("load_failed");
      return (await res.json()) as ExpenseDto;
    },
  });

  const loaded = itemQuery.data;

  useEffect(() => {
    if (!opened) return;
    if (mode === "create") {
      setTitle("");
      setDescription("");
      setAmount("");
      setCurrency(EXPENSE_CURRENCIES[0]);
      setDepartment(DEV_DEPARTMENTS[0]);
      setCategory(EXPENSE_CATEGORIES[0]);
      setExpenseDate(defaultDate());
      setPendingReceipt(null);
      setReceiptError(null);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
      return;
    }
    if (mode === "edit" && loaded) {
      setTitle(loaded.title);
      setDescription(loaded.description ?? "");
      setAmount(loaded.amount);
      setCurrency(loaded.currency);
      setDepartment(loaded.department);
      setCategory(loaded.category);
      setExpenseDate(loaded.expenseDate.slice(0, 10));
      setPendingReceipt(null);
      setReceiptError(null);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  }, [opened, mode, loaded, expenseId]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await request("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          amount: Number(amount),
          currency,
          department,
          category,
          expenseDate: new Date(expenseDate).toISOString(),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "create_failed");
      }
      const created = (await res.json()) as ExpenseDto;
      return { created, file: pendingReceipt };
    },
    onSuccess: async ({ created, file }) => {
      setReceiptError(null);
      if (file) {
        const up = await uploadExpenseReceipt(created.id, file);
        if (!up.ok) {
          const t = await up.text();
          setReceiptError(t || "Saved, but receipt upload failed. You can add it from the list.");
        }
      }
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onClose();
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await request(`/api/expenses/${expenseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          amount: Number(amount),
          currency,
          department,
          category,
          expenseDate: new Date(expenseDate).toISOString(),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "save_failed");
      }
      return (await res.json()) as ExpenseDto;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense", expenseId] });
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onClose();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const res = await request(`/api/expenses/${expenseId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onClose();
    },
  });

  const receiptMut = useMutation({
    mutationFn: async (file: File) => {
      const res = await uploadExpenseReceipt(expenseId!, file);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "upload_failed");
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expense", expenseId] });
      await qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const busy = createMut.isPending || saveMut.isPending || deleteMut.isPending;
  const titleStr = mode === "create" ? "Add expense" : "Edit expense";
  const showForm = mode === "create" || (mode === "edit" && loaded && !itemQuery.isLoading);
  const editHead = (
    <div className="field" style={{ marginTop: 0 }}>
      <label htmlFor={`${p}-rc`}>Receipt</label>
      {loaded?.hasReceipt && (
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.88rem" }}>
          <button
            type="button"
            className="link-out"
            onClick={async () => {
              try {
                await apiViewInNewTab(`/api/expenses/${expenseId}/receipt`, loaded.receiptName ?? "receipt");
              } catch {
                window.alert("Could not open receipt.");
              }
            }}
          >
            View
          </button>{" "}
          {loaded.receiptName ? (
            <button
              type="button"
              className="link-out"
              onClick={async () => {
                try {
                  await apiDownload(`/api/expenses/${expenseId}/receipt`, loaded.receiptName!);
                } catch {
                  window.alert("Download failed");
                }
              }}
            >
              Download
            </button>
          ) : null}
        </p>
      )}
      <input
        ref={receiptInputRef}
        id={`${p}-rc`}
        type="file"
        disabled={receiptMut.isPending}
        onChange={async (ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = "";
          if (f) {
            try {
              await receiptMut.mutateAsync(f);
            } catch (err) {
              window.alert((err as Error).message);
            }
          }
        }}
      />
      <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.35rem" }}>
        {loaded?.hasReceipt ? "Replace the file above, or keep the existing receipt." : "Attach a PDF or image."}
      </p>
    </div>
  );

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={titleStr}
      size="xl"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      {mode === "edit" && itemQuery.isLoading && (
        <p className="muted" style={{ margin: 0 }}>
          Loading…
        </p>
      )}
      {mode === "edit" && itemQuery.isError && <p role="alert">Could not load this expense.</p>}
      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "create") {
              createMut.mutate();
            } else {
              saveMut.mutate();
            }
          }}
        >
          <div className="field">
            <label htmlFor={`${p}-title`}>Title</label>
            <input
              id={`${p}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor={`${p}-desc`}>Description</label>
            <textarea
              id={`${p}-desc`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="toolbar" style={{ alignItems: "flex-end" }}>
            <div>
              <label htmlFor={`${p}-amt`}>Amount</label>
              <input
                id={`${p}-amt`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                    e.preventDefault();
                  }
                }}
                required
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor={`${p}-cur`}>Currency</label>
              <select
                id={`${p}-cur`}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ maxWidth: "7rem" }}
                disabled={busy}
              >
                {mode === "edit" && !(EXPENSE_CURRENCIES as readonly string[]).includes(currency) && currency ? (
                  <option value={currency}>{currency}</option>
                ) : null}
                {EXPENSE_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${p}-dept`}>Department</label>
              <input
                id={`${p}-dept`}
                list={`${p}-dept-list`}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                disabled={busy}
              />
              <datalist id={`${p}-dept-list`}>
                {DEV_DEPARTMENT_SUGGESTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor={`${p}-cat`}>Category</label>
              <select
                id={`${p}-cat`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={busy}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${p}-date`}>Date</label>
              <input
                id={`${p}-date`}
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                disabled={busy}
              />
            </div>
          </div>
          {mode === "create" && (
            <div className="field">
              <label htmlFor={`${p}-receipt`}>Receipt (optional)</label>
              <input
                ref={receiptInputRef}
                id={`${p}-receipt`}
                type="file"
                disabled={busy}
                onChange={(e) => {
                  setReceiptError(null);
                  setPendingReceipt(e.target.files?.[0] ?? null);
                }}
              />
              <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.35rem" }}>
                Uploaded after save. You can add one later from the list.
              </p>
            </div>
          )}
          {mode === "edit" && editHead}
          {(mode === "create" ? createMut.isError : saveMut.isError) && (
            <p role="alert">{((mode === "create" ? createMut.error : saveMut.error) as Error).message}</p>
          )}
          {receiptError && mode === "create" && <p role="alert">{receiptError}</p>}
          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>
              {mode === "create" ? (createMut.isPending ? "Saving…" : "Add expense") : saveMut.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            {mode === "edit" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Delete this expense?")) {
                    deleteMut.mutate();
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      )}
    </FormModal>
  );
}
