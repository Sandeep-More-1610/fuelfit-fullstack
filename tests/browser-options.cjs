// Use installed Edge on Windows; CI installs Playwright's matching Chromium build.
module.exports = process.env.CI || process.env.BROWSER_CHANNEL === 'chromium'
  ? {headless:true} : {channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true};
