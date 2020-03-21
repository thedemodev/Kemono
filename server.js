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
    dotfiles: 'allow',
    setHeaders: (res) => res.setHeader('Cache-Control', 's-maxage=2592000')
  }))
  .use('/attachments', express.static(`${process.env.DB_ROOT}/attachments`, {
    dotfiles: 'allow',
    setHeaders: (res) => res.setHeader('Cache-Control', 's-maxage=2592000')
  }))
  .use('/inline', express.static(`${process.env.DB_ROOT}/inline`, {
    dotfiles: 'allow',
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
    let index = await lookup
      .find({
        service: 'patreon',
        name: {
          $regex: esc(req.query.q),
          $options: 'i'
        }
      })
      .limit(50)
      .map(user => user.id)
      .toArray();
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=2592000');
    res.json(index);
  })
  .get('/api/fanbox/lookup', async(req, res) => {
    if (!req.query.q || req.query.q.length > 35) return res.sendStatus(400);
    let index = await lookup
      .find({
        service: 'fanbox',
        name: {
          $regex: esc(req.query.q),
          $options: 'i'
        }
      })
      .limit(50)
      .map(user => user.id)
      .toArray();
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=2592000');
    res.json(index);
  })
  .get('/api/gumroad/lookup', async(req, res) => {
    if (!req.query.q || req.query.q.length > 35) return res.sendStatus(400);
    let index = await lookup
      .find({
        service: 'gumroad',
        name: {
          $regex: esc(req.query.q),
          $options: 'i'
        }
      })
      .limit(50)
      .map(user => user.id)
      .toArray();
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=2592000');
    res.json(index);
  })
  .get('/api/user/:id', async(req, res) => {
    let userPosts = await posts.find({ user: req.params.id })
      .sort({ published_at: -1 })
      .skip(Number(req.query.skip) || 0)
      .limit(Number(req.query.limit) || 25)
      .toArray();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.json(userPosts);
  })
  .get('/api/fanbox/user/:id', async(req, res) => {
    let userPosts = await posts.find({ user: req.params.id, service: 'fanbox' })
      .sort({ published_at: -1 })
      .skip(Number(req.query.skip) || 0)
      .limit(Number(req.query.limit) || 25)
      .toArray();
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=2592000');
    res.json(userPosts);
  })
  .get('/api/gumroad/user/:id', async(req, res) => {
    let userPosts = await posts.find({ user: req.params.id, service: 'gumroad' })
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
          .on('message', msg => console.log(msg)) // logging
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
        res.setHeader('Cache-Control', 'max-age=2629800, public, stale-while-revalidate=2592000');
        res.json(user);
      })
      .catch(() => res.sendStatus(404));
  })
  .get('/proxy/fanbox/user/:id', async(req, res) => {
    let api = 'https://fanbox.pixiv.net/api/creator.get?userId';
    request
      .get(`${api}=${req.params.id}`, { 
        json: true, 
        headers: {
          'origin': 'https://www.pixiv.net',
          'cookie': `PHPSESSID=${process.env.FANBOX_KEY}`
        }
      })
      .then(user => {
        res.setHeader('Cache-Control', 'max-age=2629800, public, stale-while-revalidate=2592000');
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

      res.setHeader('Cache-Control', 'max-age=2629800, public, stale-while-revalidate=2592000');
      res.json(user);
    } catch {
      res.sendStatus(404)
    }
  })
  .listen(process.env.PORT || 8080)