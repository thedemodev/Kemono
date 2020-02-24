require('dotenv').config()
const request = require('request-promise');
const scrapeIt = require('scrape-it');
const getUrls = require('get-urls');
const { posts, lookup } = require('./db');
const { Worker } = require('worker_threads')
const cloudscraper = require('cloudscraper').defaults({onCaptcha: require('./captcha')()});
const bodyParser = require('body-parser');
const express = require('express');
const esc = require('escape-string-regexp')
const compression = require('compression');
const query = require('json-query');
require('./indexer')()
posts.createIndex({ user: 1 });
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
  .get('/fanbox/user/:id', (req, res) => {
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.sendFile(__dirname + '/www/fanbox/user.html');
  })
  .get('/gumroad/user/:id', (req, res) => {
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.sendFile(__dirname + '/www/gumroad/user.html');
  })
  .get('/api/lookup', async(req, res) => {
    if (!req.query.q || req.query.q.length > 35) return res.sendStatus(400)
    let index = await lookup.find({version: 1}).toArray();
    let results = query(`[*name~/${esc(req.query.q)}/i].id`, {
      data: index,
      allowRegexp: true
    });
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=2592000');
    res.json(results.value);
  })
  .get('/api/fanbox/lookup', async(req, res) => {
    if (!req.query.q || req.query.q.length > 35) return res.sendStatus(400)
    let index = await lookup.find({version: 2, service: 'fanbox'}).toArray();
    let results = query(`[*name~/${esc(req.query.q)}/i].id`, {
      data: index,
      allowRegexp: true
    });
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=2592000');
    res.json(results.value);
  })
  .get('/api/gumroad/lookup', async(req, res) => {
    if (!req.query.q || req.query.q.length > 35) return res.sendStatus(400)
    let index = await lookup.find({version: 2, service: 'gumroad'}).toArray();
    let results = query(`[*name~/${esc(req.query.q)}/i].id`, {
      data: index,
      allowRegexp: true
    });
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=2592000');
    res.json(results.value);
  })
  .get('/api/user/:id', async(req, res) => {
    let userPosts = await posts.find({ user: req.params.id, version: 1 })
      .sort({ published_at: -1 })
      .skip(Number(req.query.skip) || 0)
      .limit(Number(req.query.limit) || 25)
      .toArray();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.json(userPosts);
  })
  .get('/api/fanbox/user/:id', async(req, res) => {
    let userPosts = await posts.find({ user: req.params.id, version: 2, service: 'fanbox' })
      .sort({ published_at: -1 })
      .skip(Number(req.query.skip) || 0)
      .limit(Number(req.query.limit) || 25)
      .toArray();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.json(userPosts);
  })
  .get('/api/gumroad/user/:id', async(req, res) => {
    let userPosts = await posts.find({ user: req.params.id, version: 2, service: 'gumroad' })
      .sort({ published_at: -1 })
      .skip(Number(req.query.skip) || 0)
      .limit(Number(req.query.limit) || 25)
      .toArray();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.json(userPosts);
  })
  .get('/api/recent', async(req, res) => {
    let recentPosts = await posts.find({})
      .sort({ added_at: -1 })
      .skip(Number(req.query.skip) || 0)
      .limit(Number(req.query.limit) || 25)
      .toArray();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.json(recentPosts);
  })
  .post('/api/import', async(req, res) => {
    if (!req.body.session_key) return res.sendStatus(401);
    switch (req.body.service) {
      case 'patreon':
        new Worker('./importer.js', { workerData: req.body.session_key })
          .on('error', err => console.error(err))
        break;
      case 'fanbox':
        new Worker('./importers/fanbox/importer.js', { workerData: req.body.session_key })
          .on('error', err => console.error(err))
        break;
      case 'gumroad':
        new Worker('./importers/gumroad/importer.js', { workerData: req.body.session_key })
          .on('error', err => console.error(err))
        break;
    }
    res.redirect('/importer/ok');
  })
  .get('/proxy/user/:id', async(req, res) => {
    let api = 'https://www.patreon.com/api/user';
    let options = cloudscraper.defaultParams;
    options['json'] = true;
    cloudscraper.get(`${api}/${req.params.id}`, options)
      .then(user => {
        res.setHeader('Cache-Control', 'max-age=600, public, stale-while-revalidate=3600');
        res.json(user);
      })
      .catch(() => res.sendStatus(404));
  })
  .get('/proxy/fanbox/user/:id', async(req, res) => {
    let api = 'https://www.pixiv.net/ajax/fanbox/creator?userId';
    request
      .get(`${api}=${req.params.id}`, { 
        json: true, 
        headers: {
          'cookie': `PHPSESSID=${process.env.FANBOX_KEY}`
        }
      })
      .then(user => {
        res.setHeader('Cache-Control', 'max-age=600, public, stale-while-revalidate=3600');
        res.json(user);
      })
      .catch(() => res.sendStatus(404));
  })
  .get('/proxy/gumroad/user/:id', async(req, res) => {
    let api = 'https://gumroad.com';
    try {
      let html = await request.get(`${api}/${req.params.id}`)
      let user = scrapeIt.scrapeHTML(html, {
        background: {
          selector: '.profile-background-container.js-background-image-container img',
          attr: 'src'
        },
        avatar: {
          selector: '.profile-picture.js-profile-picture',
          attr: 'style',
          convert: x => {
            let urls = getUrls(x, {
              sortQueryParameters: false,
              stripWWW: false
            });
            return urls.values().next().value.replace(');', '')
          }
        },
        name: 'h2.creator-profile-card__name.js-creator-name'
      })

      res.setHeader('Cache-Control', 'max-age=600, public, stale-while-revalidate=3600');
      res.json(user);
    } catch {
      res.sendStatus(404)
    }
  })
  .listen(process.env.PORT || 8080)