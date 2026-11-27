import { feedbackMailUrl } from './feedback-mail';

describe('feedbackMailUrl', () => {
  it('kodiert Betreff und Text', () => {
    expect(feedbackMailUrl('a@b.de', 'Feedback zu App', 'Zeile 1\nä & ?')).toBe(
      'mailto:a@b.de?subject=Feedback%20zu%20App&body=Zeile%201%0A%C3%A4%20%26%20%3F',
    );
  });
});
