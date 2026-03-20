import { HttpError } from "../lib/http";

export function toPrimaryQuantity(input: {
  enteredQuantity: number;
  unitType: "PRIMARY" | "SECONDARY";
  factor?: number | null;
}) {
  if (input.unitType === "PRIMARY") return input.enteredQuantity;
  if (!input.factor || input.factor <= 0) {
    throw new HttpError(400, "Missing conversion factor for secondary unit");
  }
  return input.enteredQuantity * input.factor;
}
