const express = require('express');
const { isUUID } = require('./validation');

function ensureUUID(paramName) {
  return function(req, res, next) {
    const value = req.params[paramName];
    if (isUUID(value)) {
      return next();
    }

    res.statusCode = 400;
    res.send({
      error: {
        message: `Malformed UUID: ${value}`,
      },
    });
  };
}

function createStorageRouter(Model, storage) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const model = Model.decode(req.body);
    await storage.store(model);
    res.statusCode = 201;
    res.set('location', `${req.baseUrl}/${model.id}`);
    res.end();
  });

  router.get('/:modelId', ensureUUID('modelId'), async (req, res) => {
    const result = await storage.fetch(req.params.modelId);
    if (!result) {
      res.statusCode = 404;
      return res.end();
    }
    res.send(Model.encode(result));
  });

  return router;
}

module.exports = {
  createStorageRouter,
};
