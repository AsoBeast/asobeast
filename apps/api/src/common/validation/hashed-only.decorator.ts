const HASHED_ONLY_FIELDS = Symbol('hashedOnlyFields');

type FieldOwner = { [HASHED_ONLY_FIELDS]?: readonly string[] };

export function HashedOnly(): PropertyDecorator {
  return (target, property) => {
    const owner = target.constructor as FieldOwner;
    owner[HASHED_ONLY_FIELDS] = [
      ...(owner[HASHED_ONLY_FIELDS] ?? []),
      String(property),
    ];
  };
}

export function hashedOnlyFieldsOf(metatype: unknown): ReadonlySet<string> {
  const owner = metatype as FieldOwner | undefined;
  return new Set(owner?.[HASHED_ONLY_FIELDS] ?? []);
}
