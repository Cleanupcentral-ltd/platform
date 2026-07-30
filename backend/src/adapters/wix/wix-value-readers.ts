import { ApplicationError } from "../../domain/errors.js";

type WixRecordData = Readonly<
  Record<string, unknown>
>;

function mappingError(
  fieldName: string,
  expectedType: string,
  actualValue: unknown,
): ApplicationError {
  return new ApplicationError({
    code: "STORAGE_ERROR",

    message:
      `Wix returned an invalid value for ${fieldName}.`,

    statusCode: 502,

    details: {
      fieldName,
      expectedType,
      actualValue,
    },
  });
}

export function requireString(
  data: WixRecordData,
  fieldName: string,
): string {
  const value = data[fieldName];

  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw mappingError(
      fieldName,
      "non-empty string",
      value,
    );
  }

  return value;
}

export function readNullableString(
  data: WixRecordData,
  fieldName: string,
): string | null {
  const value = data[fieldName];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw mappingError(
      fieldName,
      "string or null",
      value,
    );
  }

  return value;
}

export function requireBoolean(
  data: WixRecordData,
  fieldName: string,
): boolean {
  const value = data[fieldName];

  if (typeof value !== "boolean") {
    throw mappingError(
      fieldName,
      "boolean",
      value,
    );
  }

  return value;
}

export function readNullableNumber(
  data: WixRecordData,
  fieldName: string,
): number | null {
  const value = data[fieldName];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw mappingError(
      fieldName,
      "finite number or null",
      value,
    );
  }

  return value;
}

export function requireReferenceId(
  data: WixRecordData,
  fieldName: string,
): string {
  const value = data[fieldName];

  if (
    typeof value === "string" &&
    value.length > 0
  ) {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const record = value as Record<
      string,
      unknown
    >;

    const possibleId =
      record.id ?? record._id;

    if (
      typeof possibleId === "string" &&
      possibleId.length > 0
    ) {
      return possibleId;
    }
  }

  throw mappingError(
    fieldName,
    "Wix reference ID",
    value,
  );
}

export function requireEnumValue<
  const Values extends readonly string[],
>(
  data: WixRecordData,
  fieldName: string,
  allowedValues: Values,
): Values[number] {
  const value = requireString(
    data,
    fieldName,
  );

  if (
    !allowedValues.includes(
      value as Values[number],
    )
  ) {
    throw mappingError(
      fieldName,
      allowedValues.join(" | "),
      value,
    );
  }

  return value as Values[number];
}

export function readNullableEnumValue<
  const Values extends readonly string[],
>(
  data: WixRecordData,
  fieldName: string,
  allowedValues: Values,
): Values[number] | null {
  const value = readNullableString(
    data,
    fieldName,
  );

  if (value === null) {
    return null;
  }

  if (
    !allowedValues.includes(
      value as Values[number],
    )
  ) {
    throw mappingError(
      fieldName,
      allowedValues.join(" | "),
      value,
    );
  }

  return value as Values[number];
}

export function requireNumber(
  data: WixRecordData,
  fieldName: string,
): number {
  const value = data[fieldName];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw mappingError(
      fieldName,
      "finite number",
      value,
    );
  }

  return value;
}

export function requireStringArray(
  data: WixRecordData,
  fieldName: string,
): readonly string[] {
  const value = data[fieldName];

  if (
    !Array.isArray(value) ||
    !value.every(
      (item) => typeof item === "string",
    )
  ) {
    throw mappingError(
      fieldName,
      "array of strings",
      value,
    );
  }

  return value;
}

export function requireRecord(
  data: WixRecordData,
  fieldName: string,
): Readonly<Record<string, unknown>> {
  const value = data[fieldName];

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw mappingError(
      fieldName,
      "object",
      value,
    );
  }

  return value as Readonly<
    Record<string, unknown>
  >;
}

export function readNullableRecord(
  data: WixRecordData,
  fieldName: string,
): Readonly<Record<string, unknown>> | null {
  const value = data[fieldName];

  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw mappingError(
      fieldName,
      "object or null",
      value,
    );
  }

  return value as Readonly<
    Record<string, unknown>
  >;
}

export function readNullableReferenceId(
  data: WixRecordData,
  fieldName: string,
): string | null {
  const value = data[fieldName];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value === "string" &&
    value.length > 0
  ) {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const reference = value as Record<
      string,
      unknown
    >;

    const possibleId =
      reference.id ?? reference._id;

    if (
      typeof possibleId === "string" &&
      possibleId.length > 0
    ) {
      return possibleId;
    }
  }

  throw mappingError(
    fieldName,
    "Wix reference ID or null",
    value,
  );
}