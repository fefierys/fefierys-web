"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  sendCommissionClientMessageAction,
  type CommissionClientMessageActionState,
} from "@/app/admin/(protected)/commissions/actions";
import CommissionEmailRetryButton from "@/components/admin/CommissionEmailRetryButton";
import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import type {
  CommissionEmailMessage,
} from "@/lib/repositories/commissionAdminRepository";

type ConversationMessage = Pick<
  CommissionEmailMessage,
  | "id"
  | "direction"
  | "kind"
  | "deliveryStatus"
  | "messageText"
  | "createdAt"
  | "sentAt"
  | "failedAt"
>;

interface CommissionConversationPanelProps {
  commissionId: string;
  messages: ConversationMessage[];
  subject: string | null;
  threadExists: boolean;
  threadReady: boolean;
}

const initialActionState: CommissionClientMessageActionState = {
  outcome: "idle",
  message: null,
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

function shouldShowPersistedMessageText(
  message: ConversationMessage,
): boolean {
  if (
    message.direction ===
    "inbound"
  ) {
    return true;
  }

  return (
    message.kind ===
      "general_message" ||
    message.kind ===
      "client_details_request"
  );
}

function supportsRetry(
  message: ConversationMessage,
): boolean {
  if (
    message.direction !==
      "outbound" ||
    message.deliveryStatus !==
      "failed"
  ) {
    return false;
  }

  return (
    message.kind ===
      "inquiry_confirmation" ||
    message.kind ===
      "client_details_request" ||
    message.kind ===
      "general_message" ||
    message.kind ===
      "quote_ready"
  );
}

function getAutomatedMessageSummary(
  kind: CommissionEmailMessage["kind"],
): string {
  switch (kind) {
    case "inquiry_confirmation":
      return "Project inquiry confirmation sent to the client.";

    case "quote_ready":
      return "Commission quote sent to the client.";

    case "agreement_ready":
      return "Commission agreement sent to the client.";

    case "payment_request":
      return "Payment request sent to the client.";

    case "payment_confirmation":
      return "Payment confirmation sent to the client.";

    case "sketch_review":
      return "Sketch review sent to the client.";

    case "final_review":
      return "Final review sent to the client.";

    case "final_delivery":
      return "Final artwork delivery sent to the client.";

    case "commission_completed":
      return "Commission completion message sent to the client.";

    case "general_message":
      return "Message sent to the client.";

    case "client_details_request":
      return "Additional project details requested from the client.";

    default:
      return humanize(
        kind,
      );
  }
}

function getDisplayText(
  message: ConversationMessage,
): string {
  const persistedText =
    message.messageText?.trim();

  if (
    persistedText &&
    shouldShowPersistedMessageText(
      message,
    )
  ) {
    return persistedText;
  }

  return getAutomatedMessageSummary(
    message.kind,
  );
}

function getMessageDate(
  message: ConversationMessage,
): Date {
  return (
    message.sentAt ??
    message.failedAt ??
    message.createdAt
  );
}

function getDeliveryStatusClasses(
  status: ConversationMessage["deliveryStatus"],
): string {
  switch (status) {
    case "sent":
      return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";

    case "failed":
      return "border-red-300/20 bg-red-300/10 text-red-100";

    case "sending":
      return "border-sky-300/20 bg-sky-300/10 text-sky-100";

    case "queued":
    default:
      return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  }
}

export default function CommissionConversationPanel({
  commissionId,
  messages,
  subject,
  threadExists,
  threadReady,
}: CommissionConversationPanelProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    sendCommissionClientMessageAction,
    initialActionState,
  );

  const [
    messageText,
    setMessageText,
  ] = useState("");

  const conversationEndRef =
    useRef<HTMLDivElement>(
      null,
    );

  const hasBlockingOutbound =
    messages.some(
      (message) =>
        message.direction ===
          "outbound" &&
        (
          message.deliveryStatus ===
            "queued" ||
          message.deliveryStatus ===
            "sending" ||
          message.deliveryStatus ===
            "failed"
        ),
    );

  const canSend =
    threadExists &&
    threadReady &&
    !hasBlockingOutbound;

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      block: "nearest",
    });
  }, [messages.length]);

  useEffect(() => {
    if (
      state.outcome !==
        "success" &&
      state.outcome !==
        "warning"
    ) {
      return;
    }

    const frame =
      window.requestAnimationFrame(
        () => {
          setMessageText("");
        },
      );

    return () => {
      window.cancelAnimationFrame(
        frame,
      );
    };
  }, [state]);

  let composerMessage:
    | string
    | null = null;

  if (!threadExists) {
    composerMessage =
      "The client email conversation is unavailable for this commission.";
  } else if (!threadReady) {
    composerMessage =
      "The conversation is waiting for the initial email to finish syncing.";
  } else if (
    hasBlockingOutbound
  ) {
    composerMessage =
      "An earlier client email is still queued, sending, or failed. It must be resolved before another message can be sent.";
  }

  const feedbackClasses =
    state.outcome ===
    "success"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : state.outcome ===
          "warning"
        ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
        : "border-red-300/20 bg-red-300/10 text-red-100";

  return (
    <section className="glass-card overflow-hidden">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-light">
              Conversation
            </h2>

            <p className="mt-1 text-xs leading-relaxed text-white/50">
              Client-facing communication for this project.
            </p>
          </div>

          {threadReady && (
            <span className="w-fit shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
              Thread active
            </span>
          )}
        </div>

        {subject && (
          <p className="mt-3 break-words text-xs text-white/40">
            {subject}
          </p>
        )}
      </div>

      <div className="max-h-[34rem] overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        {messages.length ===
        0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
            <p className="text-sm text-white/60">
              No client messages have been recorded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(
              (
                message,
              ) => {
                const outbound =
                  message.direction ===
                  "outbound";

                const showFullText =
                  shouldShowPersistedMessageText(
                    message,
                  );

                return (
                  <article
                    className={
                      outbound
                        ? "ml-auto max-w-[92%] sm:max-w-[82%]"
                        : "mr-auto max-w-[92%] sm:max-w-[82%]"
                    }
                    key={
                      message.id
                    }
                  >
                    <div
                      className={
                        outbound
                          ? "rounded-2xl rounded-br-md border border-[#aeb5e0]/20 bg-[#5966A5]/35 px-4 py-3.5"
                          : "rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-4 py-3.5"
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-[0.1em] text-white/55">
                          {outbound
                            ? "Fefierys"
                            : "Client"}
                        </p>

                        {outbound && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${getDeliveryStatusClasses(
                              message.deliveryStatus,
                            )}`}
                          >
                            {humanize(
                              message.deliveryStatus,
                            )}
                          </span>
                        )}
                      </div>

                      {!showFullText && (
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-white/45">
                          {humanize(
                            message.kind,
                          )}
                        </p>
                      )}

                      <p
                        className={
                          showFullText
                            ? "mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90"
                            : "mt-1.5 break-words text-sm leading-relaxed text-white/80"
                        }
                      >
                        {getDisplayText(
                          message,
                        )}
                      </p>
                    </div>

                    <div
                      className={`mt-1.5 flex items-center gap-2 px-1 text-[11px] text-white/40 ${
                        outbound
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {showFullText && (
                        <>
                          <span>
                            {humanize(
                              message.kind,
                            )}
                          </span>

                          <span>
                            ·
                          </span>
                        </>
                      )}

                      <time>
                        {formatCommissionDate(
                          getMessageDate(
                            message,
                          ),
                        )}
                      </time>
                    </div>

                    {supportsRetry(
                      message,
                    ) && (
                      <CommissionEmailRetryButton
                        commissionId={
                          commissionId
                        }
                        messageId={
                          message.id
                        }
                      />
                    )}
                  </article>
                );
              },
            )}

            <div
              ref={
                conversationEndRef
              }
            />
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-white/[0.025] px-4 py-5 sm:px-6">
        {state.outcome !==
          "idle" &&
          state.message && (
            <p
              className={`mb-4 rounded-xl border px-3 py-2.5 text-sm ${feedbackClasses}`}
            >
              {
                state.message
              }
            </p>
          )}

        {composerMessage && (
          <p className="mb-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] px-3 py-2.5 text-sm leading-relaxed text-amber-100/85">
            {
              composerMessage
            }
          </p>
        )}

        <form
          action={
            formAction
          }
        >
          <input
            name="commissionId"
            type="hidden"
            value={
              commissionId
            }
          />

          <label
            className="text-xs uppercase tracking-[0.12em] text-white/45"
            htmlFor={`commission-client-message-${commissionId}`}
          >
            Send a message
          </label>

          <textarea
            className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/30 focus:border-white/25 focus:bg-white/[0.07] focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              !canSend ||
              pending
            }
            id={`commission-client-message-${commissionId}`}
            maxLength={
              5000
            }
            name="messageText"
            onChange={(
              event,
            ) =>
              setMessageText(
                event
                  .target
                  .value,
              )
            }
            placeholder="Write a message to the client..."
            required
            value={
              messageText
            }
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/40">
              {
                messageText.length
              }
              /5000
            </p>

            <button
              className="rounded-xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={
                !canSend ||
                pending ||
                messageText.trim()
                  .length ===
                  0
              }
              type="submit"
            >
              {pending
                ? "Sending..."
                : "Send message"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}