const { defineConfig } = require('cypress');
const preprocessor = require('@badeball/cypress-cucumber-preprocessor');
const browserify = require('@badeball/cypress-cucumber-preprocessor/browserify');

async function setupNodeEvents(on, config) {
  await preprocessor.addCucumberPreprocessorPlugin(on, config);

  on('file:preprocessor', browserify.default(config));

  // Make sure to return the config object as it might have been modified by the plugin.
  return config;
}

module.exports = defineConfig({
  env: {
    TAGS: 'not @ignore',
  },
  e2e: {
    baseUrl: 'http://localhost:8080',
    specPattern: '**/*.feature',
    supportFile: './cypress/support/e2e.js',
    setupNodeEvents,
    video: false,
    screenshotOnRunFailure: false,
  },
});
