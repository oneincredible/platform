const {
  createPromoteRevision,
  createFetchRevision,
  createStoreRevision,
} = require('./query');
const { Type } = require('../model/field');

function noop(value) {
  return value;
}

function createRelationStorageAdapter(ChildStorageAdapter, parent, child) {
  const tableName = `${parent}_${child}s`;

  const Query = {
    fetch(parentId) {
      return {
        text: `SELECT ${child}_id AS id FROM ${tableName} WHERE ${parent}_id = $1`,
        values: [parentId],
      };
    },

    add(parentId, childId) {
      return {
        text: `INSERT INTO ${tableName} (${parent}_id, ${child}_id) VALUES($1, $2)`,
        values: [parentId, childId],
      };
    },

    remove(parentId, childId) {
      return {
        text: `DELETE FROM ${tableName} WHERE ${parent}_id = $1 AND ${child}_id = $2`,
        values: [parentId, childId],
      };
    },
  };

  class RelationStorageAdapter extends Storage {
    constructor(db) {
      super(db);
      this.storage = new ChildStorageAdapter(db);
    }

    async fetch(parentId) {
      const result = await this.db.query(Query.fetch(parentId));
      return await Promise.all(
        result.rows.map(row => this.storage.fetch(row.id))
      );
    }

    add(parentId, relationId) {
      return this.db.query(Query.add(parentId, relationId));
    }

    remove(parentId, relationId) {
      return this.db.query(Query.remove(parentId, relationId));
    }
  }

  return RelationStorageAdapter;
}

function createRevisionedStorageAdapter(Model, tableName) {
  const listFields = Model.fields.filter(field => field.type === Type.LIST);
  const modelFields = Model.fields.filter(field => field.type === Type.MODEL);

  function createComposedStorage(db) {
    const composed = Object.create(null);
    for (const { name, StorageAdapter } of modelFields) {
      composed[name] = new StorageAdapter(db);
    }
    return composed;
  }

  function createRelationsStorage(db) {
    const relations = Object.create(null);
    for (const { name, StorageAdapter } of listFields) {
      const RelationsStorageAdapter = createRelationStorageAdapter(
        StorageAdapter,
        tableName,
        name
      );
      relations[name] = new RelationsStorageAdapter(db);
    }
    return relations;
  }

  const Query = {
    fetchRevision: createFetchRevision(Model, tableName),
    storeRevision: createStoreRevision(Model, tableName),
    promoteRevision: createPromoteRevision(tableName),
  };

  class RevisionedStorageAdapter extends Storage {
    constructor(db) {
      super(db);
      this.composed = createComposedStorage(db);
      this.relations = createRelationsStorage(db);
    }

    async fetch(modelId, prepare = noop) {
      const result = await this.db.query(Query.fetchRevision(modelId));
      if (result.rowCount === 0) {
        return null;
      }

      const model = result.rows[0];

      await Promise.all([
        ...modelFields.map(async ({ name, columnName }) => {
          model[name] = await this.composed[name].fetch(model[columnName]);
          delete model[columnName];
        }),
        ...listFields.map(async ({ name }) => {
          model[name] = await this.relations[name].fetch(model.id);
        }),
      ]);

      return prepare(model);
    }

    async store(model) {
      await Promise.all(
        modelFields.map(({ name }) => {
          return this.composed[name].store(model[name]);
        })
      );

      try {
        await this.db.query('BEGIN');

        const result = await this.db.query(Query.storeRevision(model));

        const { revision } = result.rows[0];

        await this.db.query(Query.promoteRevision(model, revision));

        await this.db.query('COMMIT');
      } catch (error) {
        await this.db.query('ROLLBACK');
        throw error;
      }
    }
  }

  return RevisionedStorageAdapter;
}

class Storage {
  constructor(db) {
    this.db = db;
  }
}

module.exports = {
  createRevisionedStorageAdapter,
  createRelationStorageAdapter,
  Storage,
};