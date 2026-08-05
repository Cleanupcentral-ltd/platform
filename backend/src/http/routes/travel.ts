import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { z } from "zod";

import type {
  TravelCalculationService,
} from "../../application/calculate-travel.js";

import {
  HttpError,
} from "../http-errors.js";

const travelRequestSchema =
  z.strictObject({
    postcode: z
      .string()
      .trim()
      .min(5)
      .max(12)
      .regex(
        /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/,
        "Enter a valid UK postcode.",
      ),
  });

const TRAVEL_RATE_LIMIT = {
  max: 20,
  timeWindow: "1 minute",
  groupId: "travel-calculation",
} as const;

export interface TravelRouteDependencies {
  readonly service:
    TravelCalculationService;
}

function readMediaType(
  request: FastifyRequest,
): string {
  const contentType =
    request.headers["content-type"];

  return typeof contentType ===
    "string"
    ? (
        contentType
          .split(";", 1)[0]
          ?.trim()
          .toLowerCase() ?? ""
      )
    : "";
}

export function registerTravelRoutes(
  app: FastifyInstance,
  dependencies:
    TravelRouteDependencies,
): void {
  app.post(
    "/api/travel/estimate",
    {
      bodyLimit: 4 * 1024,

      config: {
        rateLimit:
          TRAVEL_RATE_LIMIT,
      },
    },

    async (
      request,
      reply,
    ): Promise<FastifyReply> => {
      if (
        readMediaType(request) !==
        "application/json"
      ) {
        throw new HttpError({
          code:
            "UNSUPPORTED_MEDIA_TYPE",

          message:
            "Travel calculations must use application/json.",

          statusCode: 415,
        });
      }

      const result =
        travelRequestSchema
          .safeParse(request.body);

      if (!result.success) {
        throw new HttpError({
          code: "VALIDATION_ERROR",

          message:
            "Enter a valid UK postcode.",

          statusCode: 400,
        });
      }

      const calculation =
        await dependencies.service
          .calculate(
            result.data.postcode,
          );

      request.log.info(
        {
          requestId: request.id,
          travelStatus:
            calculation.status,

          manualReviewReason:
            calculation
              .manualReviewReason,
        },

        "Travel estimate processed",
      );

      return reply
        .header(
          "Cache-Control",
          "no-store",
        )
        .status(200)
        .type("application/json")
        .send({
          success: true,

          travel: {
            status:
              calculation.status,

            fee:
              calculation.fee,

            distanceMiles:
              calculation
                .distanceMiles ===
              null
                ? null
                : Math.round(
                    calculation
                      .distanceMiles *
                      100,
                  ) / 100,

            pendingReview:
              calculation
                .pendingReview,

            reason:
              calculation
                .manualReviewReason,
          },

          requestId: request.id,
        });
    },
  );
}
