import { searchCandidates } from './search-candidates';
import { parseCv } from './parse-cv';
import { rankCandidates } from './rank-candidates';
import { draftEmail } from './draft-email';
import { searchWeb } from './search-web';
import { generateReport } from './generate-report';

export const allTools = {
  searchCandidates,
  parseCv,
  rankCandidates,
  draftEmail,
  searchWeb,
  generateReport,
};
