import type { OpenSlideConfig } from '@open-slide/core';

const openSlideConfig: OpenSlideConfig = {
  // Local: http://localhost:5173 ; GitHub Pages: /sac-slides/.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/sac-slides/' : '/',
};

export default openSlideConfig;
