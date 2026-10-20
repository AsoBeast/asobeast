const COUNT_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

export const formatCount = (value: number): string =>
  COUNT_FORMAT.format(value);

export const formatStars = (value: number): string => value.toFixed(2);
