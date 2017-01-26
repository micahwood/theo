const { constant }  = require('core.lambda')
const Either = require('data.either')
const fs = require('fs')
const Immutable = require('immutable-ext')
const JSON5 = require('json5')
const path = require('path')
const yaml = require('js-yaml')

const load = file =>
  Either
    .try(fs.readFileSync)(file)
    .map(buffer => buffer.toString())
    .map(data =>
      ({ file, data })
    )

const parse = ({ file, data }) => {
  switch (path.extname(file)) {
    case '.yaml':
    case '.yml':
      return Either
        .try(yaml.safeLoad)(data)
    case '.json':
    case '.json5':
      return Either
        .try(JSON5.parse)(data)
    default:
      return Either.Left(`Unable to parse file "${file}"`)
  }
}

const resolve = ({ file, data }) =>
  Either
    .fromNullable(data)
    .map(constant({ file, data }))
    .orElse(() => load(file))
    .chain(parse)
    .map(Immutable.fromJS)
    .map(parsed =>
      Immutable
        .fromJS({
          global: {},
          props: {},
          aliases: {},
          imports: []
        })
        .merge(parsed)
    )
    .chain(parsed => parsed
      .get('imports')
      .traverse(Either.of, i =>
        Either
          .of(path.resolve(path.dirname(file), i))
          .chain(load)
          .chain(resolve)
      )
      .map(parsedImports =>
        parsed.set('imports', parsedImports))
    )

module.exports = {
  load,
  parse,
  resolve
}