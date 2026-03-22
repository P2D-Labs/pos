export type FormField = { name: string; label: string; type?: "text" | "number" | "boolean" };

export type ModuleConfig = {
  path: string;
  title: string;
  endpoint: string;
  createFields?: FormField[];
};
