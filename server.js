require('dotenv').config()
const { posts, lookup } = require('./db');
const { Worker } = require('worker_threads')
const cloudscraper = require('cloudscraper').defaults({onCaptcha: require('./captcha')()});
const bodyParser = require('body-parser');
const cache = require('memory-cache');
const express = require('express');
const esc = require('escape-string-regexp')
const compression = require('compression');
const query = require('json-query');
posts.ensureIndex({fieldName: 'user'});
require('./indexer')()
express()
  .use(compression())
  .use(bodyParser.urlencoded({ extended: false }))
  .use(bodyParser.json())
  .use(express.static('public', {
    extensions: ['html', 'htm'],
    setHeaders: (res) => res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000')
  }))
  .use('/files', express.static(`${process.env.DB_ROOT}/files`, {
    setHeaders: (res) => res.setHeader('Cache-Control', 's-maxage=2592000')
  }))
  .use('/attachments', express.static(`${process.env.DB_ROOT}/attachments`, {
    setHeaders: (res) => res.setHeader('Cache-Control', 's-maxage=2592000')
  }))
  .use('/inline', express.static(`${process.env.DB_ROOT}/inline`, {
    setHeaders: (res) => res.setHeader('Cache-Control', 's-maxage=2592000')
  }))
  .get('/user/:id', (req, res) => {
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.sendFile(__dirname + '/www/user.html');
  })
  .get('/api/lookup', async(req, res) => {
    if (!req.query.q || req.query.q.length > 35) return res.sendStatus(400)
    lookup.loadDatabase();
    let index = await lookup.find({});
    let results = query(`[*name~/${esc(req.query.q)}/i].id`, {
      data: index,
      allowRegexp: true
    });
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=2592000');
    res.json(results.value);
  })
  .get('/api/user/:id', async(req, res) => {
    posts.loadDatabase();
    let userPosts = await posts.cfind({ user: req.params.id })
      .sort({ published_at: -1 })
      .skip(Number(req.query.skip) || 0)
      .limit(Number(req.query.limit) || 25)
      .exec();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.json(userPosts);
  })
  .get('/api/recent', async(req, res) => {
    posts.loadDatabase();
    let recentPosts = await posts.cfind({})
      .sort({ added_at: -1 })
      .skip(Number(req.query.skip) || 0)
      .limit(Number(req.query.limit) || 25)
      .exec();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.json(recentPosts);
  })
  .post('/api/import', async(req, res) => {
    if (!req.body.session_key) res.sendStatus(401);
    const worker = new Worker('./importer.js', { workerData: req.body.session_key });
    worker.on('error', (err) => console.log(`Importer thread died: ${err}`));
    res.redirect('/importer/ok');
  })
  .get('/proxy/user/:id', async(req, res) => {
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