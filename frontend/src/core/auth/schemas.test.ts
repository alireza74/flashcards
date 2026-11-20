import { codeSchema, passwordSchema, signInSchema, signUpSchema } from './schemas';

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe('passwordSchema (wie Server: 8 Zeichen, Buchstaben und Ziffern)', () => {
  it('gueltiges Passwort', () => {
    expect(passwordSchema.safeParse('Passwort123').success).toBe(true);
  });

  it('zu kurz', () => {
    expect(firstMessage(passwordSchema.safeParse('abc12'))).toBe('validation.passwordLength');
  });

  it('ohne Ziffer', () => {
    expect(firstMessage(passwordSchema.safeParse('nurbuchstaben'))).toBe('validation.passwordDigits');
  });

  it('ohne Buchstaben', () => {
    expect(firstMessage(passwordSchema.safeParse('1234567890'))).toBe('validation.passwordLetters');
  });
});

describe('signInSchema', () => {
  it('E-Mail wird getrimmt', () => {
    const result = signInSchema.safeParse({ email: '  a@b.de ', password: 'x' });
    expect(result.success && result.data.email).toBe('a@b.de');
  });

  it('ungueltige E-Mail', () => {
    expect(firstMessage(signInSchema.safeParse({ email: 'keine-mail', password: 'x' }))).toBe(
      'validation.email',
    );
  });

  it('leere E-Mail', () => {
    expect(firstMessage(signInSchema.safeParse({ email: '', password: 'x' }))).toBe(
      'validation.required',
    );
  });
});

describe('signUpSchema', () => {
  const valid = {
    displayName: 'Alice',
    email: 'alice@example.test',
    password: 'Passwort123',
    passwordConfirm: 'Passwort123',
  };

  it('gueltige Eingaben', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it('Passwoerter stimmen nicht ueberein', () => {
    const result = signUpSchema.safeParse({ ...valid, passwordConfirm: 'Anders123' });
    expect(firstMessage(result)).toBe('validation.passwordMismatch');
    expect(result.error?.issues[0]?.path).toEqual(['passwordConfirm']);
  });
});

describe('codeSchema', () => {
  it('genau 6 Ziffern', () => {
    expect(codeSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(codeSchema.safeParse({ code: ' 123456 ' }).success).toBe(true);
    expect(codeSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(codeSchema.safeParse({ code: '12345a' }).success).toBe(false);
  });
});
