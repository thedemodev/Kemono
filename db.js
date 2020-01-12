const Datastore = require('nedb-promise');
const db = {
  posts: new Datastore({ filename: `${process.env.DB_ROOT}/posts.db` }),
  lookup: new Datastore({ filename: `${process.env.DB_ROOT}/lookup.db` })
};

module.exports = db;