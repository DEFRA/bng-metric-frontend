/**
 * Summarise a backend error response for the log without logging its body.
 * The backend's Boom payload carries a reason phrase (`error`) and a
 * `message`; only the reason phrase is logged, because a message can echo
 * user-supplied input. The backend logs the full error on its own side.
 * @param {unknown} error - the error Wreck threw
 * @returns {string}
 */
export function describeBackendError(error) {
  return error?.data?.payload?.error ?? 'none'
}
