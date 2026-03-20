export type SelectOption = {
  id: string;
  label: string;
};

export type LineDraft = {
  itemId: string;
  unitType: "PRIMARY" | "SECONDARY";
  unitId: string;
  quantity: number;
  price: number;
  discount: number;
  taxRate: number;
};
