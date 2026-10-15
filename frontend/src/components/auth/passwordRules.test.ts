import * as Yup from 'yup';
import { withPasswordComplexity } from './passwordRules';

const schema = withPasswordComplexity(Yup.string().required());

describe('password policy', () => {
    test('accepts exactly 72 ASCII bytes', () => {
        expect(schema.isValidSync('Aa1!' + 'x'.repeat(68))).toBe(true);
    });
    test('rejects a password longer than the BCrypt byte limit', () => {
        expect(schema.isValidSync('Aa1!' + 'x'.repeat(69))).toBe(false);
    });
    test('counts UTF-8 bytes rather than Unicode characters', () => {
        expect(schema.isValidSync('Aa1!' + 'ą'.repeat(34))).toBe(true);
        expect(schema.isValidSync('Aa1!' + 'ą'.repeat(35))).toBe(false);
    });
    test.each(['lowercase1!', 'UPPERCASE1!', 'NoNumber!', 'NoSpecial1', 'Aa1! xxxxx'])('rejects %s', password => {
        expect(schema.isValidSync(password)).toBe(false);
    });
});
