import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProviderInstanceId } from "@t3tools/contracts";
import { T, useGT } from "gt-react";
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react";

import {
  type AutoswitchProvider,
  type FallbackOrderRow,
  defaultConnectedOrder,
  fallbackOrderRows,
  moveInFallbackOrder,
} from "../../atum/providerAutoswitch.logic";
import { cn } from "~/lib/utils";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { FoldedSettingsSection } from "./FoldedSettingsSection";
import { useSearchableSetting } from "./settingsSearch";

/**
 * "When a plan runs out": the account's opt-in provider order. Off by default; an empty order is
 * off. The engine switches at the next turn and comes back after the reset.
 */
export function ProviderFallbackSettings(props: {
  readonly order: ReadonlyArray<ProviderInstanceId>;
  readonly providers: ReadonlyArray<AutoswitchProvider>;
  readonly disabled?: boolean;
  readonly onChange: (order: ReadonlyArray<ProviderInstanceId>) => void;
  readonly onSignIn: (instanceId: ProviderInstanceId) => void;
}) {
  const gt = useGT();
  const searchableSetting = useSearchableSetting();
  const { order, providers, onChange } = props;
  const enabled = order.length > 0;
  const rows = fallbackOrderRows(order, providers);
  const connected = rows.filter((row) => row.connected);
  // One connected plan has nothing to switch to.
  const canEnable = connected.length > 1;
  const { id, title } = searchableSetting("provider-fallback");
  if (rows.length === 0) return null;

  return (
    <FoldedSettingsSection
      id={id}
      title={title}
      summary={
        enabled
          ? connected.map((row) => row.name).join(" → ")
          : gt("Off", { $context: "switching plans when one runs out is turned off" })
      }
      control={
        <Switch
          aria-label={gt("Switch plans when one runs out")}
          checked={enabled}
          disabled={props.disabled || (!enabled && !canEnable)}
          onCheckedChange={(checked) => onChange(checked ? defaultConnectedOrder(providers) : [])}
        />
      }
    >
      <div className="space-y-2.5 px-3 py-3 sm:px-4">
        <p className="text-xs text-muted-foreground">
          {canEnable ? (
            <T>Your next message goes to the next plan here, and comes back when yours resets.</T>
          ) : (
            <T>Connect a second plan to switch when one runs out.</T>
          )}
        </p>
        <FallbackOrderList
          rows={rows}
          disabled={props.disabled === true || !enabled}
          onMove={(instanceId, steps) => onChange(moveInFallbackOrder(rows, instanceId, steps))}
          onSignIn={props.onSignIn}
        />
      </div>
    </FoldedSettingsSection>
  );
}

function FallbackOrderList(props: {
  readonly rows: ReadonlyArray<FallbackOrderRow>;
  readonly disabled: boolean;
  readonly onMove: (instanceId: ProviderInstanceId, steps: number) => void;
  readonly onSignIn: (instanceId: ProviderInstanceId) => void;
}) {
  const gt = useGT();
  const { rows } = props;
  const sortable = rows.filter((row) => row.connected).map((row) => row.instanceId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    if (event.over === null || event.active.id === event.over.id) return;
    const from = sortable.indexOf(String(event.active.id) as ProviderInstanceId);
    const to = sortable.indexOf(String(event.over.id) as ProviderInstanceId);
    if (from !== -1 && to !== -1) props.onMove(sortable[from]!, to - from);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[...sortable]} strategy={verticalListSortingStrategy}>
        <ol
          aria-label={gt("Plans, in the order they take over")}
          className="divide-y divide-border/60 rounded-lg border border-border/60"
        >
          {rows.map((row) => (
            <FallbackOrderItem
              key={row.instanceId}
              row={row}
              position={sortable.indexOf(row.instanceId) + 1}
              count={sortable.length}
              disabled={props.disabled || !row.connected}
              onMove={(steps) => props.onMove(row.instanceId, steps)}
              onSignIn={() => props.onSignIn(row.instanceId)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function FallbackOrderItem(props: {
  readonly row: FallbackOrderRow;
  readonly position: number;
  readonly count: number;
  readonly disabled: boolean;
  readonly onMove: (steps: number) => void;
  readonly onSignIn: () => void;
}) {
  const gt = useGT();
  const { row, position, disabled } = props;
  const name = row.name;
  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.instanceId, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-connected={row.connected ? "true" : "false"}
      className={cn(
        "grid grid-cols-[1rem_1rem_minmax(0,1fr)_auto] items-center gap-x-2.5 py-1.5 ps-3 pe-1.5",
        !row.connected && "text-muted-foreground",
        isDragging && "relative z-10 rounded-lg bg-background shadow-md",
      )}
    >
      <span className="text-xs tabular-nums text-muted-foreground">
        {row.connected ? position : null}
      </span>
      <ProviderInstanceIcon
        driverKind={row.driverKind}
        displayName={name}
        size="compact"
        className={cn(!row.connected && "opacity-45")}
      />
      <span className="min-w-0 truncate text-sm leading-5">{name}</span>
      <span className="flex items-center gap-0.5">
        {row.connected ? (
          <>
            <span
              ref={setActivatorNodeRef}
              {...(disabled ? {} : listeners)}
              aria-hidden
              className={cn(
                "hidden size-6 shrink-0 items-center justify-center rounded text-muted-foreground/70 sm:flex",
                disabled
                  ? "opacity-40"
                  : "cursor-grab touch-none hover:text-foreground active:cursor-grabbing",
              )}
            >
              <GripVerticalIcon className="size-3.5" />
            </span>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost-muted"
              disabled={disabled || position === 1}
              aria-label={gt("Move {name} up", { name })}
              onClick={() => props.onMove(-1)}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost-muted"
              disabled={disabled || position === props.count}
              aria-label={gt("Move {name} down", { name })}
              onClick={() => props.onMove(1)}
            >
              <ArrowDownIcon />
            </Button>
          </>
        ) : (
          <Button type="button" size="xs" variant="outline" onClick={props.onSignIn}>
            <T>Sign in</T>
          </Button>
        )}
      </span>
    </li>
  );
}
