import { HttpError } from "@/lib/api";
import { PwaAuthTransactionError } from "@/lib/pwa-auth-transactions";

export function toPwaAuthHttpError(error: unknown) {
  if (!(error instanceof PwaAuthTransactionError)) {
    return error;
  }

  if (error.code === "store-unavailable") {
    return new HttpError(503, error.message);
  }
  if (error.code === "missing") {
    return new HttpError(410, error.message);
  }
  if (error.code === "invalid") {
    return new HttpError(401, error.message);
  }

  return new HttpError(409, error.message);
}
