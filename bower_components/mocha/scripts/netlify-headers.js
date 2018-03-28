'use strict';

const AssetGraph = require('assetgraph');

const headers = [
  'Content-Security-Policy'
];

const resourceHintTypeMap = {
  HtmlPreloadLink: 'preload',
  HtmlPrefetchLink: 'prefetch',
  HtmlPreconnectLink: 'preconnect',
  HtmlDnsPrefetchLink: 'dns-prefetch'
};

function getHeaderForRelation (rel) {
  let header = `Link: <${rel.href}>; rel=${resourceHintTypeMap[rel.type]}; as=${rel.as}; type=${rel.to.contentType}`;

  if (rel.as === 'font') {
    header = `${header}; crossorigin=anonymous`;
  }

  return header;
}

new AssetGraph({ root: 'docs/_dist' })
  .loadAssets('*.html')
  .populate({
    followRelations: { type: 'HtmlAnchor', crossorigin: false }
  })
  .queue(function (assetGraph) {
    const assets = assetGraph.findAssets({ type: 'Html', isInline: false });

    const headerMap = {};

    assets.forEach(function (asset) {
      const url = '/' + asset.url.replace(assetGraph.root, '').replace(/#.*/, '').replace('index.html', '');
      if (!headerMap[url]) {
        headerMap[url] = [];
      }

      headers.forEach(function (header) {
        const node = asset.parseTree.querySelector('meta[http-equiv=' + header + ']');

        if (node) {
          headerMap[url].push(`${header}: ${node.getAttribute('content')}`);

          node.parentNode.removeChild(node);
          asset.markDirty();
        }
      });

      const firstCssRel = asset.outgoingRelations.filter(r => {
        return r.type === 'HtmlStyle' &&
                    r.crossorigin === false &&
                    r.href !== undefined;
      })[0];

      if (firstCssRel) {
        const header = `Link: <${firstCssRel.href}>; rel=preload; as=style`;

        headerMap[url].push(header);
      }

      const resourceHintRelations = asset.outgoingRelations.filter(r => ['HtmlPreloadLink', 'HtmlPrefetchLink'].includes(r.type));

      resourceHintRelations.forEach(rel => {
        headerMap[url].push(getHeaderForRelation(rel));

        rel.detach();
      });

      const preconnectRelations = asset.outgoingRelations.filter(r => ['HtmlPreconnectLink'].includes(r.type));

      preconnectRelations.forEach(rel => {
        let header = `Link: <${rel.href}>; rel=preconnect`;

        headerMap[url].push(header);

        rel.detach();
      });
    });

    console.log('\n## Autogenerated headers:\n');

    Object.keys(headerMap).forEach(function (url) {
      console.log(url);

      const httpHeaders = headerMap[url];

      httpHeaders.forEach(function (header) {
        console.log(`  ${header}`);
      });

      console.log('');
    });
  })
  .writeAssetsToDisc({ isLoaded: true })
  .run();
