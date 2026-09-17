import { ValidateBy, type ValidationOptions } from 'class-validator';

function utcDayOf(value: string): string {
  const instant = Date.parse(value);
  return Number.isNaN(instant)
    ? ''
    : new Date(instant).toISOString().slice(0, 10);
}

export function NotBefore(
  property: string,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'notBefore',
      constraints: [property],
      validator: {
        validate: (value: unknown, args) => {
          const earlier: unknown = args && Reflect.get(args.object, property);
          if (typeof value !== 'string' || typeof earlier !== 'string') {
            return true;
          }
          return utcDayOf(value) >= utcDayOf(earlier);
        },
        defaultMessage: (args) =>
          `${args?.property} must not be before ${property}`,
      },
    },
    options,
  );
}
