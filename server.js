require('dotenv').config()
const Datastore = require('nedb-promise');
const db = new Datastore({filename: `${process.env.DB_ROOT}/posts.db`});
const cloudscraper = require('cloudscraper').defaults({onCaptcha: require('./captcha')()});
const bodyParser = require('body-parser');
const cache = require('memory-cache');
const express = require('express');
const compression = require('compression');
const importer = require('./importer');
db.ensureIndex({fieldName: 'user'});
express()
  .use(compression())
  .use(bodyParser.urlencoded({ extended: false }))
  .use(bodyParser.json())
  .use(express.static('public', {
    extensions: ['html', 'htm'],
    setHeaders: (res) => res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate')
  }))
  .use('/files', express.static(`${process.env.DB_ROOT}/files`, {
    setHeaders: (res) => res.setHeader('Cache-Control', 's-maxage=2592000')
  }))
  .use('/attachments', express.static(`${process.env.DB_ROOT}/attachments`, {
    setHeaders: (res) => res.setHeader('Cache-Control', 's-maxage=2592000')
  }))
  .get('/user/:id', (req, res) => {
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
    res.sendFile(__dirname + '/www/user.html');
  })
  .get('/api/user/:id', async(req, res) => {
    await db.loadDatabase();
    let userPosts = await db.cfind({ user: req.params.id }).sort({ published_at: -1 }).skip(req.query.skip || 0).limit(req.query.limit || 25).exec();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
    res.json(userPosts);
  })
  .get('/api/recent', async(req, res) => {
    await db.loadDatabase();
    let recentPosts = await db.cfind({}).sort({ added_at: -1 }).skip(req.query.skip || 0).limit(req.query.limit || 25).exec();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
    res.json(recentPosts);
  })
  .post('/api/import', async(req, res) => {
    if (!req.body.session_key) res.sendStatus(401);
    importer(req.body.session_key)
    res.redirect('/importer/ok')
  })
  .get('/proxy/user/:id', async(req, res) => {
    let options = cloudscraper.defaultParams;
    options['json'] = true;
    let api = 'https://www.patreon.com/api/user';
    if (!cache.get(req.params.id)) {
      let options = cloudscraper.defaultParams;
      options['json'] = true;
      let user = await cloudscraper.get(`${api}/${req.params.id}`).catch(() => res.sendStatus(404));
      await cache.put(req.params.id, user, 600000);
    }
    res.setHeader('Cache-Control', 'max-age=600, public');
    res.json(cache.get(req.params.id));
  })
  .listen(process.env.PORT || 8080)