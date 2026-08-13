import type { z } from "zod";

type ZodTypeName = string;

interface ZodDef {
  typeName: ZodTypeName;
  shape?: () => Record<string, z.ZodTypeAny>;
  innerType?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
  values?: readonly string[];
  options?: readonly z.ZodTypeAny[];
  valueType?: z.ZodTypeAny;
  checks?: Array<{ min?: number; max?: number }>;
}

export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def as ZodDef;

  switch (def.typeName) {
    case "ZodObject": {
      const shape = def.shape?.() ?? {};
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, child] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(child);
        const childName = (child._def as ZodDef).typeName;
        if (childName !== "ZodOptional" && childName !== "ZodDefault") {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }
    case "ZodString":
      return { type: "string" };
    case "ZodNumber": {
      const constraints: Record<string, unknown> = {};
      for (const check of def.checks ?? []) {
        if (check.min != null) {
          constraints.minimum = check.min;
        }
        if (check.max != null) {
          constraints.maximum = check.max;
        }
      }
      return { type: "number", ...constraints };
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return {
        type: "array",
        items: def.type ? zodToJsonSchema(def.type) : {},
      };
    case "ZodOptional":
    case "ZodDefault":
    case "ZodEffects":
      return def.innerType ? zodToJsonSchema(def.innerType) : {};
    case "ZodEnum":
      return {
        type: "string",
        enum: [...(def.values ?? [])],
      };
    case "ZodLiteral": {
      const literal = (schema as z.ZodLiteral<unknown>).value;
      return {
        type: typeof literal === "number" ? "number" : "string",
        const: literal,
      };
    }
    case "ZodUnion":
      return {
        anyOf: (def.options ?? []).map((option) => zodToJsonSchema(option)),
      };
    case "ZodRecord":
      return {
        type: "object",
        additionalProperties: def.valueType ? zodToJsonSchema(def.valueType) : {},
      };
    default:
      return { type: "object" };
  }
}
