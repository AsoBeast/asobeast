export const STREAMING_SEGMENT_GUARD = `(() => {
  let completeSegment;
  const guarded = (segmentId, placeholderId) => {
    if (document.getElementById(placeholderId)) {
      completeSegment(segmentId, placeholderId);
      return;
    }
    document.getElementById(segmentId)?.remove();
  };
  Object.defineProperty(window, "$RS", {
    configurable: true,
    get: () => completeSegment && guarded,
    set: (instruction) => {
      completeSegment = instruction;
    },
  });
})();`;
