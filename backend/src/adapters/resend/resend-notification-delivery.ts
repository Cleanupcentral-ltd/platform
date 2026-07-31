import type {
  NotificationDelivery,
  NotificationDeliveryReceipt,
  NotificationDraft,
  NotificationRecipient,
} from "../../ports/notifications.js";

export interface ResendNotificationConfig {
  readonly apiKey: string;

  readonly from:
    NotificationRecipient;

  readonly apiBaseUrl?: string;

  readonly timeoutMs?: number;

  readonly retryDelaysMs?:
    readonly number[];

  readonly fetch?: typeof globalThis.fetch;

  readonly now?: () => Date;

  readonly wait?: (
    milliseconds: number,
  ) => Promise<void>;
}

export class NotificationProviderError
  extends Error
{
  readonly code: string;
  readonly statusCode:
    number | null;

  constructor(
    options: {
      readonly code: string;
      readonly message: string;
      readonly statusCode?:
        number | null;
      readonly cause?: unknown;
    },
  ) {
    super(options.message, {
      cause: options.cause,
    });

    this.name =
      "NotificationProviderError";

    this.code = options.code;

    this.statusCode =
      options.statusCode ?? null;
  }
}

interface ProviderErrorBody {
  readonly name?: unknown;
  readonly message?: unknown;
}

interface ProviderSuccessBody {
  readonly id?: unknown;
}

function recipientAddress(
  recipient:
    NotificationRecipient,
): string {
  const name =
    recipient.name?.trim() ?? "";

  return name.length === 0
    ? recipient.email
    : `${name} <${recipient.email}>`;
}

function safeProviderCode(
  value: unknown,
  statusCode: number,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    return `RESEND_HTTP_${statusCode}`;
  }

  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return normalized.length === 0
    ? `RESEND_HTTP_${statusCode}`
    : `RESEND_${normalized}`;
}

function isRetryableStatus(
  statusCode: number,
  providerName: unknown,
): boolean {
  if (
    statusCode === 408 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
  ) {
    return true;
  }

  return (
    statusCode === 409 &&
    providerName ===
      "concurrent_idempotent_requests"
  );
}

async function responseJson(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function defaultWait(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export class ResendNotificationDelivery
  implements NotificationDelivery
{
  private readonly apiBaseUrl:
    string;

  private readonly timeoutMs:
    number;

  private readonly retryDelaysMs:
    readonly number[];

  private readonly fetch:
    typeof globalThis.fetch;

  private readonly now:
    () => Date;

  private readonly wait:
    (
      milliseconds: number,
    ) => Promise<void>;

  constructor(
    private readonly config:
      ResendNotificationConfig,
  ) {
    this.apiBaseUrl = (
      config.apiBaseUrl ??
      "https://api.resend.com"
    ).replace(/\/+$/, "");

    this.timeoutMs =
      config.timeoutMs ?? 10_000;

    this.retryDelaysMs =
      config.retryDelaysMs ??
      [0, 250, 750];

    this.fetch =
      config.fetch ??
      globalThis.fetch;

    this.now =
      config.now ??
      (() => new Date());

    this.wait =
      config.wait ??
      defaultWait;
  }

  async send(
    draft:
      NotificationDraft,
  ): Promise<NotificationDeliveryReceipt> {
    if (
      draft.idempotencyKey.length < 1 ||
      draft.idempotencyKey.length > 256
    ) {
      throw new NotificationProviderError({
        code:
          "INVALID_NOTIFICATION_IDEMPOTENCY_KEY",

        message:
          "The notification idempotency key is invalid.",
      });
    }

    if (draft.to.length === 0) {
      throw new NotificationProviderError({
        code:
          "NOTIFICATION_RECIPIENT_REQUIRED",

        message:
          "At least one notification recipient is required.",
      });
    }

    let lastError: unknown = null;

    for (
      let attempt = 0;
      attempt <
        this.retryDelaysMs.length;
      attempt += 1
    ) {
      const delay =
        this.retryDelaysMs[
          attempt
        ] ?? 0;

      if (delay > 0) {
        await this.wait(delay);
      }

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => controller.abort(),
          this.timeoutMs,
        );

      try {
        const response =
          await this.fetch(
            `${this.apiBaseUrl}/emails`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${this.config.apiKey}`,

                "Content-Type":
                  "application/json",

                "Idempotency-Key":
                  draft.idempotencyKey,
              },

              body: JSON.stringify({
                from:
                  recipientAddress(
                    this.config.from,
                  ),

                to:
                  draft.to.map(
                    ({ email }) => email,
                  ),

                ...(draft.replyTo ===
                null
                  ? {}
                  : {
                      reply_to:
                        recipientAddress(
                          draft.replyTo,
                        ),
                    }),

                subject:
                  draft.subject,

                text:
                  draft.text,

                html:
                  draft.html,
              }),

              signal:
                controller.signal,
            },
          );

        const body =
          await responseJson(
            response,
          );

        if (response.ok) {
          const messageId =
            (
              body as
                ProviderSuccessBody |
                null
            )?.id;

          if (
            typeof messageId !==
              "string" ||
            messageId.length === 0
          ) {
            throw new NotificationProviderError({
              code:
                "RESEND_INVALID_RESPONSE",

              message:
                "The email provider returned an invalid success response.",

              statusCode:
                response.status,
            });
          }

          return {
            providerMessageId:
              messageId,

            acceptedAt:
              this.now()
                .toISOString(),
          };
        }

        const providerName =
          (
            body as
              ProviderErrorBody |
              null
          )?.name;

        const code =
          safeProviderCode(
            providerName,
            response.status,
          );

        const error =
          new NotificationProviderError({
            code,

            message:
              "The email provider rejected the notification.",

            statusCode:
              response.status,
          });

        if (
          !isRetryableStatus(
            response.status,
            providerName,
          ) ||
          attempt ===
            this.retryDelaysMs
              .length -
              1
        ) {
          throw error;
        }

        lastError = error;
      } catch (error) {
        if (
          error instanceof
            NotificationProviderError
        ) {
          if (
            attempt ===
              this.retryDelaysMs
                .length -
                1 ||
            (
              error.statusCode !==
                null &&
              !isRetryableStatus(
                error.statusCode,
                null,
              )
            )
          ) {
            throw error;
          }

          lastError = error;
          continue;
        }

        lastError = error;

        if (
          attempt ===
          this.retryDelaysMs.length -
            1
        ) {
          throw new NotificationProviderError({
            code:
              "RESEND_NETWORK_ERROR",

            message:
              "The email provider could not be reached.",

            cause: error,
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new NotificationProviderError({
      code:
        "RESEND_DELIVERY_FAILED",

      message:
        "The email provider could not accept the notification.",

      cause: lastError,
    });
  }
}
