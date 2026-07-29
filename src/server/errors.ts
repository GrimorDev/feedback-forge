import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "Validation failed",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  throw error;
}

