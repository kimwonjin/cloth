import { josa } from '../korean';

describe('josa', () => {
  it('chooses particles by final consonant', () => {
    expect(josa('아우터', '은', '는')).toBe('아우터는');
    expect(josa('신발', '은', '는')).toBe('신발은');
    expect(josa('상의', '이', '가')).toBe('상의가');
    expect(josa('액세서리', '이', '가')).toBe('액세서리가');
    expect(josa('하의', '을', '를')).toBe('하의를');
  });
});
