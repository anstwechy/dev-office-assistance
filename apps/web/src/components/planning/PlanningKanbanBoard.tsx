import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { PlanningItemDto, PlanningStatus } from "@office/types";
import { PLANNING_STATUSES } from "@office/types";
import { PLANNING_STATUS_LABEL } from "../../constants/planningLabels";
import "./planning-board.css";

function planningStatusFromDropTarget(
  overId: string | undefined,
  items: PlanningItemDto[],
): PlanningStatus | null {
  if (!overId) return null;
  if (PLANNING_STATUSES.includes(overId as PlanningStatus)) {
    return overId as PlanningStatus;
  }
  const hit = items.find((i) => i.id === overId);
  return hit ? hit.status : null;
}

function PlanningCard({
  item,
  disabled,
}: {
  item: PlanningItemDto;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled,
  });

  const style = transform ? { transform: CSS.Transform.toString(transform) } : undefined;
  const a11yDrag = {
    ...attributes,
    role: "group" as const,
    "aria-roledescription": "draggable",
    tabIndex: -1,
  };

  const dateLabel = item.targetDate ? item.targetDate.slice(0, 10) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`planning-card${isDragging ? " planning-card--dragging" : ""}${disabled ? " planning-card--disabled" : ""}`}
      {...a11yDrag}
      {...listeners}
      aria-label={`${item.title}. Drag to change status, or use the link to edit.`}
    >
      <div className="planning-card__handle" aria-hidden="true">
        <svg className="planning-card__grip" viewBox="0 0 20 20" width="16" height="16" aria-hidden>
          <path
            fill="currentColor"
            d="M7 3.5a1.5 1.5 0 1 0 0 3.01 1.5 1.5 0 0 0 0-3.01zm6 0a1.5 1.5 0 1 0 0 3.01 1.5 1.5 0 0 0 0-3.01zM7 8.25a1.5 1.5 0 1 0 0 3.01 1.5 1.5 0 0 0 0-3.01zm6 0a1.5 1.5 0 1 0 0 3.01 1.5 1.5 0 0 0 0-3.01zM7 13a1.5 1.5 0 1 0 0 3.01 1.5 1.5 0 0 0 0-3.01zm6 0a1.5 1.5 0 1 0 0 3.01 1.5 1.5 0 0 0 0-3.01z"
          />
        </svg>
      </div>
      <Link
        className="planning-card__link"
        to={{ pathname: "/planning", search: new URLSearchParams({ edit: item.id }).toString() }}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="planning-card__inner">
          <p className="planning-card__title">{item.title}</p>
          <div className="planning-card__meta">
            {dateLabel ? <span className="planning-card__date">{dateLabel}</span> : <span>No target date</span>}
            {item.department ? (
              <span className="planning-card__dept" title={item.department}>
                {item.department}
              </span>
            ) : null}
            {item.program ? (
              <span className="planning-card__dept" title={item.program}>
                {item.program}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
}

function PlanningColumn({
  status,
  items,
  disabled,
  isDropTarget,
}: {
  status: PlanningStatus;
  items: PlanningItemDto[];
  disabled: boolean;
  isDropTarget: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  const highlight = isOver || isDropTarget;

  return (
    <div
      ref={setNodeRef}
      className={`planning-column planning-column--status-${status} ${highlight ? "planning-column--over" : ""}`}
    >
      <div className="planning-column__head">
        <h3 className="planning-column__title">{PLANNING_STATUS_LABEL[status]}</h3>
        <span className="planning-column__count" aria-label={`${items.length} in ${PLANNING_STATUS_LABEL[status]}`}>
          {items.length}
        </span>
      </div>
      <div className="planning-column__body">
        {items.length === 0 ? (
          <p className="planning-column__empty">
            {disabled ? "Updating…" : "Drop initiatives here or add one below."}
          </p>
        ) : (
          items.map((item) => <PlanningCard key={item.id} item={item} disabled={disabled} />)
        )}
      </div>
    </div>
  );
}

export type PlanningKanbanBoardProps = {
  items: PlanningItemDto[];
  statusFilter: PlanningStatus | "";
  onMove: (id: string, nextStatus: PlanningStatus) => void;
  disabled?: boolean;
  announce: (message: string) => void;
};

export function PlanningKanbanBoard({
  items,
  statusFilter,
  onMove,
  disabled = false,
  announce,
}: PlanningKanbanBoardProps) {
  const [overStatus, setOverStatus] = useState<PlanningStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 5 },
    }),
  );

  const visible = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((i) => i.status === statusFilter);
  }, [items, statusFilter]);

  const byColumn = useMemo(() => {
    const map: Record<PlanningStatus, PlanningItemDto[]> = {
      draft: [],
      active: [],
      done: [],
      cancelled: [],
    };
    for (const item of visible) {
      map[item.status].push(item);
    }
    return map;
  }, [visible]);

  function handleDragOver(e: DragOverEvent) {
    if (!e.over) {
      setOverStatus(null);
      return;
    }
    const next = planningStatusFromDropTarget(String(e.over.id), items);
    setOverStatus(next);
  }

  function handleDragEnd(e: DragEndEvent) {
    const draggedId = String(e.active.id);
    setOverStatus(null);
    const next = planningStatusFromDropTarget(e.over?.id as string | undefined, items);
    if (!next) return;
    const current = items.find((i) => i.id === draggedId);
    if (!current || current.status === next) return;
    onMove(draggedId, next);
    announce(`Moved “${current.title}” to ${PLANNING_STATUS_LABEL[next]}.`);
  }

  function handleDragCancel() {
    setOverStatus(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setOverStatus(null)}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="planning-board-wrap">
        <div className="planning-board" aria-label="Initiatives by status">
          {PLANNING_STATUSES.map((status) => (
            <PlanningColumn
              key={status}
              status={status}
              items={byColumn[status]}
              disabled={disabled}
              isDropTarget={overStatus === status}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
