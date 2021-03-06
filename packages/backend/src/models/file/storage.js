const { createRevisionedStorageAdapter } = require('@oneinc/super-api/storage');
const { File } = require('./model');

const FileStorage = createRevisionedStorageAdapter(File, 'file');

module.exports = {
  FileStorage,
};
