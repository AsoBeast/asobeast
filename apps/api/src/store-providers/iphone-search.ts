const IPHONE_SEARCH_DEVICES = /^(iPhone|iPod)/;

export function listedInIphoneSearch(
  supportedDevices: readonly string[] | undefined,
): boolean {
  return (
    supportedDevices === undefined ||
    supportedDevices.some((device) => IPHONE_SEARCH_DEVICES.test(device))
  );
}
