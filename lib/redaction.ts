const REDACTED = "[redacted]";
const SECRET_KEY_PATTERN =
  /(api[-_ ]?key|apikey|token|secret|authorization|cookie|password|bearer|credential|webmaster[-_ ]?id)/i;
const MIN_SECRET_VALUE_LENGTH = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSecretValues(secretValues: string[]): string[] {
  return Array.from(
    new Set(
      secretValues
        .map((value) => value.trim())
        .filter((value) => value.length >= MIN_SECRET_VALUE_LENGTH)
    )
  ).sort((a, b) => b.length - a.length);
}

function redactSecretString(value: string, secretValues: string[]): string {
  return secretValues.reduce(
    (redactedValue, secretValue) => redactedValue.split(secretValue).join(REDACTED),
    value
  );
}

function redactSecretsInternal(
  value: unknown,
  normalizedSecretValues: string[]
): unknown {
  if (typeof value === "string") {
    return redactSecretString(value, normalizedSecretValues);
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      redactSecretsInternal(entry, normalizedSecretValues)
    );
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      SECRET_KEY_PATTERN.test(key)
        ? REDACTED
        : redactSecretsInternal(entryValue, normalizedSecretValues),
    ])
  );
}

export function redactSecrets(
  value: unknown,
  secretValues: string[] = []
): unknown {
  return redactSecretsInternal(value, normalizeSecretValues(secretValues));
}
