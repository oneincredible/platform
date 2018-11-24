const { noop } = require('./transform');

const Type = {
  VALUE: Symbol('value field'),
  LIST: Symbol('list field'),
  MODEL: Symbol('model field'),
};

function value(name, transform = noop) {
  return {
    type: Type.VALUE,
    name,

    encode: transform.encode,
    decode: transform.decode,

    columnName: name,
    columnValue(model) {
      return model[name];
    },
  };
}

function list(name, Model) {
  return {
    type: Type.LIST,
    name,

    encode: values => (values ? values.map(Model.encode) : null),
    decode: values => (values ? values.map(Model.decode) : null),
  };
}

function model(name, Model) {
  return {
    type: Type.MODEL,
    name,

    encode: Model.encode,
    decode: Model.decode,

    columnName: `${name}_id`,
    columnValue(model) {
      return model[name].id;
    },
  };
}

module.exports = {
  Type,
  value,
  list,
  model,
};