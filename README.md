Kemono is an open-source reimplementation of [yiff.party](https://yiff.party/) built for speed and reliability. Scraping is performed asynchronously, and as of v1.3, the server only needs 20MB of working memory to function.
### Running
The source code for Kemono is provided as-is, and I have no plans to make a customizable self-host version. You can obviously still do it, but your mileage may vary and you will need to change things in the source.

- Install dependencies (`yarn install`/`npm install`)
- Copy .env.example to .env and configure
- Start the server (`yarn run dev`/`npm run dev`)

If you just want to test the importer, standalone scripts are provided at `importer-test.js` for each service. *Note that these are deprecated for the most part, and no longer maintained.*

`node importer-test.js <token>`
### Legal
[Licensed under BSD 3-Clause.](/LICENSE) [tldr.](https://www.tldrlegal.com/l/bsd3)

Kemono itself does not circumvent any technological copyright measures. Content is retrieved legally.