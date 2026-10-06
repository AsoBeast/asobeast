const hashedOnlyByClass = new WeakMap<object, readonly string[]>();

export function HashedOnly(): PropertyDecorator {
  return (target, property) => {
    const owner = target.constructor;
    hashedOnlyByClass.set(owner, [
      ...(hashedOnlyByClass.get(owner) ?? []),
      String(property),
    ]);
  };
}

export function hashedOnlyFieldsOf(metatype: unknown): ReadonlySet<string> {
  const fields = new Set<string>();
  let owner: unknown = metatype;
  while (typeof owner === 'function') {
    for (const field of hashedOnlyByClass.get(owner) ?? []) fields.add(field);
    owner = Object.getPrototypeOf(owner);
  }
  return fields;
}
