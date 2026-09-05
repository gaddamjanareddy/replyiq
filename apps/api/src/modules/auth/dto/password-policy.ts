/**
 * The one definition of what counts as an acceptable password.
 *
 * Registration and password reset must agree. If they drift, a user can set a
 * password at reset that they could not have set at signup - or worse, the
 * reset path quietly accepts something weaker than the rules the product
 * claims to enforce.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Lower, upper, digit and symbol, at the minimum length. */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{12,}$/;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
