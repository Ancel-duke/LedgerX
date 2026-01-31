/** Emitted when a user successfully completes password reset. */
export const PASSWORD_RESET_COMPLETED = 'auth.password_reset.completed';

export interface PasswordResetCompletedPayload {
  userId: string;
}
