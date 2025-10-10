const path = require('path');

const routesPath = path.join(__dirname, '..', 'routes', 'stream-history.js');
const routes = require(routesPath);

describe('stream-history compactor removal', () => {
  it('no longer exposes the compactSamples helper', () => {
    expect(routes._compactSamples).toBeUndefined();
  });
});
