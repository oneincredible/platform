const { createRevisionedStorageAdapter } = require('../storage');
const { Resolution } = require('./model');

const ResolutionStorage = createRevisionedStorageAdapter(
  Resolution,
  'resolution'
);

module.exports = {
  ResolutionStorage,
};
