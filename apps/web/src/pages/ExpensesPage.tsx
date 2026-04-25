import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExpenseDto } from "@office/types";
import { apiViewInNewTab } from "../apiClient";
import { useApi } from "../useApi";
import { PageHeader } from "../components/PageHeader";
import { DataTableSkeleton, MetricStripSkeleton } from "../components/skeletons/AppSkeletons";
import { ExpenseEntryModal } from "../components/expenses/ExpenseEntryModal";

function monthStartIso(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function monthEndIso(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString().slice(0, 10);
}

export function ExpensesPage() {
  const { request, uploadExpenseReceipt } = useApi();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const editFromUrl = searchParams.get("edit");

  const [expenseModalMode, setExpenseModalMode] = useState<"create" | "edit">("create");
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(monthStartIso(now));
  const [to, setTo] = useState(monthEndIso(now));

  const listQuery = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      const res = await request(`/api/expenses?${p.toString()}`);
      if (!res.ok) throw new Error("list_failed");
      return (await res.json()) as { expenses: ExpenseDto[] };
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["expenses-summary", from, to],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      const res = await request(`/api/expenses/summary?${p.toString()}`);
      if (!res.ok) throw new Error("summary_failed");
      return (await res.json()) as {
        byDepartment: { department: string; total: string }[];
      };
    },
  });

  useEffect(() => {
    if (editFromUrl) {
      setExpenseModalMode("edit");
      openModal();
    }
  }, [editFromUrl, openModal]);

  const closeExpenseModal = () => {
    closeModal();
    setSearchParams((params) => {
      params.delete("edit");
      return params;
    });
  };

  const openCreateModal = () => {
    setExpenseModalMode("create");
    setSearchParams((params) => {
      params.delete("edit");
      return params;
    });
    openModal();
  };

  const receiptRowMut = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const res = await uploadExpenseReceipt(id, file);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "upload_failed");
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-overview"] });
    },
  });

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Finance"
        title="Dev department expenses"
        lead="Track spend by team and month. Add or edit entries in a dialog; attach receipts there or from the list."
      />

      <section className="card" aria-label="Date range and totals">
        <div className="card__head">
          <h2 className="card__title">Summary (selected range)</h2>
          <p className="card__sub">Totals by department for the date window below.</p>
        </div>
        <div className="toolbar" style={{ alignItems: "flex-end" }}>
          <div>
            <label htmlFor="e-from">From</label>
            <input
              id="e-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="e-to">To</label>
            <input id="e-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {summaryQuery.isLoading && (
          <MetricStripSkeleton count={4} style={{ marginTop: "0.75rem" }} label="Loading expense summary" />
        )}
        {summaryQuery.data && (
          <div className="metric-strip" style={{ marginTop: "0.75rem" }}>
            {summaryQuery.data.byDepartment.map((s) => (
              <div key={s.department} className="metric">
                <span className="metric-value">{Number(s.total).toFixed(2)}</span>
                <span className="metric-label">{s.department}</span>
              </div>
            ))}
            {summaryQuery.data.byDepartment.length === 0 && (
              <p className="muted">No expenses in this range.</p>
            )}
          </div>
        )}
      </section>

      <section className="card" aria-label="Expense list">
        <div className="card__head card__head--row">
          <div>
            <h2 className="card__title">Entries</h2>
            <p className="card__sub" style={{ marginBottom: 0 }}>
              In-range rows for the dates above. Use Add to open the form, or follow a title to edit.
            </p>
          </div>
          <div className="card__head__actions">
            <button type="button" className="primary" onClick={openCreateModal}>
              Add expense
            </button>
          </div>
        </div>
        {listQuery.isLoading && (
          <DataTableSkeleton
            columns={6}
            columnLabels={["Date", "Title", "Amount", "Department", "Category", "Receipt"]}
            tableLabel="Loading expenses"
          />
        )}
        {listQuery.isError && <p role="alert">Could not load expenses.</p>}
        {listQuery.data && (
          <div className="data-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Amount</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.expenses.map((e) => {
                  const rowBusy =
                    receiptRowMut.isPending && receiptRowMut.variables?.id === e.id;
                  return (
                    <tr key={e.id}>
                      <td>{e.expenseDate.slice(0, 10)}</td>
                      <td>
                        <Link
                          to={{ pathname: "/expenses", search: new URLSearchParams({ edit: e.id }).toString() }}
                        >
                          {e.title}
                        </Link>
                      </td>
                      <td>
                        {e.currency} {e.amount}
                      </td>
                      <td className="muted">{e.department}</td>
                      <td>
                        <span className="badge">{e.category}</span>
                      </td>
                      <td>
                        <div className="expense-receipt-cell">
                          <span className="muted expense-receipt-cell__state">
                            {e.hasReceipt ? "Yes" : "—"}
                          </span>
                          {e.hasReceipt && (
                            <button
                              type="button"
                              className="link-out expense-receipt-cell__btn"
                              disabled={rowBusy}
                              onClick={async () => {
                                const name = e.receiptName ?? "receipt";
                                try {
                                  await apiViewInNewTab(
                                    `/api/expenses/${e.id}/receipt`,
                                    name,
                                  );
                                } catch {
                                  window.alert("Could not open receipt. Try editing the entry.");
                                }
                              }}
                            >
                              View
                            </button>
                          )}
                          <input
                            id={`expense-receipt-${e.id}`}
                            type="file"
                            className="expense-receipt-file"
                            tabIndex={-1}
                            aria-label={
                              e.hasReceipt
                                ? `Replace receipt for ${e.title}`
                                : `Add receipt for ${e.title}`
                            }
                            disabled={rowBusy}
                            onChange={(ev) => {
                              const f = ev.target.files?.[0];
                              ev.target.value = "";
                              if (f) {
                                receiptRowMut.mutate({ id: e.id, file: f });
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="link-out expense-receipt-cell__btn"
                            disabled={rowBusy}
                            onClick={() => {
                              document.getElementById(`expense-receipt-${e.id}`)?.click();
                            }}
                          >
                            {rowBusy ? "Uploading…" : e.hasReceipt ? "Replace" : "Add receipt"}
                          </button>
                        </div>
                        {receiptRowMut.isError && receiptRowMut.variables?.id === e.id && (
                          <p
                            className="muted"
                            style={{ fontSize: "0.8rem", margin: "0.25rem 0 0" }}
                            role="alert"
                          >
                            {(receiptRowMut.error as Error).message}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {listQuery.data.expenses.length === 0 && (
              <div className="empty-state" role="status" style={{ margin: "0.75rem" }}>
                <strong>No expenses in this range</strong>
                Adjust the date range or add an entry with &quot;Add expense&quot;.
              </div>
            )}
          </div>
        )}
      </section>

      <ExpenseEntryModal
        opened={modalOpened}
        onClose={closeExpenseModal}
        mode={expenseModalMode}
        expenseId={expenseModalMode === "edit" && editFromUrl ? editFromUrl : null}
      />
    </div>
  );
}
