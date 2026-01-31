/** Emitted when a user requests a password reset. Payload has userId only (no email) to avoid enumeration. */
export const PASSWORD_RESET_REQUESTED = 'auth.password_reset.requested';

export interface PasswordResetRequestedPayload {
  userId: string;
}
