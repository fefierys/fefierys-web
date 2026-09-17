import CommissionEventNoteButton from "@/components/admin/CommissionEventNoteButton";
import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import { COMMISSION_STATUS_LABELS } from "@/lib/commissions/commissionStatus";
import type {
  CommissionEvent,
  CommissionStatusHistoryEntry,
} from "@/lib/repositories/commissionAdminRepository";

interface CommissionActivityPanelProps {
  commissionId: string;
  events: CommissionEvent[];
  statusHistory: CommissionStatusHistoryEntry[];
}

type ActivityItem =
  | {
      createdAt: Date;
      id: string;
      kind: "status";
      value: CommissionStatusHistoryEntry;
    }
  | {
      createdAt: Date;
      id: string;
      kind: "event";
      value: CommissionEvent;
    };

function humanize(
  value: string,
): string {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

export default function CommissionActivityPanel({
  commissionId,
  events,
  statusHistory,
}: CommissionActivityPanelProps) {
  const activity: ActivityItem[] = [
    ...statusHistory.map(
      (entry) => ({
        createdAt:
          entry.createdAt,
        id:
          `status-${entry.id}`,
        kind:
          "status" as const,
        value:
          entry,
      }),
    ),

    ...events.map(
      (event) => ({
        createdAt:
          event.createdAt,
        id:
          `event-${event.id}`,
        kind:
          "event" as const,
        value:
          event,
      }),
    ),
  ].sort(
    (left, right) =>
      right.createdAt.getTime() -
      left.createdAt.getTime(),
  );

  return (
    <section className="glass-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-light">
            Activity
          </h2>

          <p className="mt-1 text-xs leading-relaxed text-white/45">
            Workflow changes, events and notes.
          </p>
        </div>

        <CommissionEventNoteButton
          commissionId={
            commissionId
          }
        />
      </div>

      <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto overscroll-contain pr-2">
        {activity.length ===
        0 ? (
          <p className="text-sm text-white/60">
            No activity recorded.
          </p>
        ) : (
          activity.map(
            (item) => {
              if (
                item.kind ===
                "status"
              ) {
                const entry =
                  item.value;

                return (
                  <article
                    className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                    key={
                      item.id
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-[#aeb5e0]/20 bg-[#5966A5]/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-white/65">
                        Status
                      </span>

                      <time className="text-[10px] text-white/40">
                        {formatCommissionDate(
                          entry.createdAt,
                        )}
                      </time>
                    </div>

                    <p className="mt-3 text-sm font-medium leading-relaxed text-white/90">
                      {entry.fromStatus
                        ? COMMISSION_STATUS_LABELS[
                            entry.fromStatus
                          ]
                        : "New inquiry"}

                      <span className="mx-1.5 text-white/35">
                        →
                      </span>

                      {
                        COMMISSION_STATUS_LABELS[
                          entry.toStatus
                        ]
                      }
                    </p>

                    <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                      {humanize(
                        entry.initiatedBy,
                      )}

                      {entry.reason
                        ? ` · ${humanize(
                            entry.reason,
                          )}`
                        : ""}
                    </p>

                    {entry.note && (
                      <p className="mt-3 whitespace-pre-wrap break-words border-t border-white/10 pt-3 text-xs leading-relaxed text-white/70">
                        {
                          entry.note
                        }
                      </p>
                    )}
                  </article>
                );
              }

              const event =
                item.value;

              return (
                <article
                  className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                  key={
                    item.id
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-white/60">
                      Event
                    </span>

                    <time className="text-[10px] text-white/40">
                      {formatCommissionDate(
                        event.createdAt,
                      )}
                    </time>
                  </div>

                  <h3 className="mt-3 text-sm font-medium leading-relaxed text-white/90">
                    {
                      event.title
                    }
                  </h3>

                  <p className="mt-1.5 text-xs leading-relaxed text-white/50">
                    {humanize(
                      event.type,
                    )}
                    {" · "}
                    {humanize(
                      event.actor,
                    )}
                  </p>

                  {event.description && (
                    <p className="mt-3 whitespace-pre-wrap break-words border-t border-white/10 pt-3 text-xs leading-relaxed text-white/70">
                      {
                        event.description
                      }
                    </p>
                  )}
                </article>
              );
            },
          )
        )}
      </div>
    </section>
  );
}