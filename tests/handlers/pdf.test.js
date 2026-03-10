import { describe, it, expect, vi } from 'vitest';
import { processPdf } from '../../src/handlers/pdf.js';

vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({
    text: 'Campaign Management Guide\n\nThis guide covers campaign setup and optimization.\n\nGetting Started\n\nCreate your first campaign by...',
  }),
}));

describe('pdf handler', () => {
  it('extracts text from a PDF buffer and returns markdown', async () => {
    const fakeBuffer = Buffer.from('fake pdf content');
    const result = await processPdf(fakeBuffer, 'campaign-guide.pdf');
    expect(result.markdown).toContain('Campaign Management Guide');
    expect(result.markdown).toContain('Getting Started');
    expect(result.slug).toBe('campaign-guide');
  });
});
