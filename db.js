const Datastore = require('nedb-promise');
const db = {
  posts: new Datastore({ filename: `${process.env.DB_ROOT}/posts.db` })
};

module.exports = db;