import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import { asApiError } from "./errors";

type AsyncRoute = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(
  fallbackMessage: string,
  handler: AsyncRoute,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch((error: unknown) => {
      next(asApiError(error, fallbackMessage));
    });
  };
}
