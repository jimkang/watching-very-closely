var config = require('./configs/config');
var callNextTick = require('call-next-tick');
var Twit = require('twit');
var async = require('async');
var fetchHeadlines = require('fetch-headlines');
var _ = require('lodash');
var probable = require('probable');
var cheerio = require('cheerio');

var keyPhrase = 'is watching closely';
var emphasizedString = '<b>' + keyPhrase + '</b>';
var watcherRegex = /[\.!\?;] (.*)is watching closely/i;
var htmlTagRegex = /\<\/?\w+>/g;
var shortenedLinkLength = 23;

var dryRun = false;
if (process.argv.length > 2) {
  dryRun = (process.argv[2].toLowerCase() == '--dry');
}

var twit = new Twit(config.twitter);
// var wordnok = createWordnok({
//   apiKey: config.wordnikAPIKey,
//   logger: {
//     log: function noOp() {}
//   }
// });

async.waterfall(
  [
    startFetch,
    distillNewsItems,
    pickItem,
    postTweet
  ],
  wrapUp
);

function startFetch(done) {
  var fetchOpts = {
    topic: '"' + keyPhrase + '"'
  };
  fetchHeadlines(fetchOpts, done);
}

function distillNewsItems(items, done) {
  var keySentences = _.pluck(items, 'summary').map(getkeySentenceFromSummary);
  var distilledItems = [];

  for (var i = 0; i < items.length; ++i) {
    if (keySentences[i]) {
      var distilledItem = {
        keySentence: keySentences[i],
        link: items[i].link
      };
      distilledItems.push(distilledItem);
    }
  }
  debugger;
  callNextTick(done, null, _.compact(distilledItems));
}

function getkeySentenceFromSummary(summary) {
  var sentence;
  $ = cheerio.load(summary);
  var fontTags = $('font[size="-1"]');
  if (fontTags.length > 1) {
    sentence = $(fontTags[1]).text();
  }

  return sentence;
}

function pickItem(items, done) {
  callNextTick(done, null, probable.pickFromArray(items));
}

function postTweet(item, done) {
  var attribution = ' ' + item.link;

  var text = item.keySentence.slice(0, 140 - shortenedLinkLength - 2);
  text += '…' + attribution;

  if (dryRun) {
    console.log('Would have tweeted:', text);
    callNextTick(done);
  }
  else {
    var body = {
      status: text
    };
    twit.post('statuses/update', body, done);
  }
}

function wrapUp(error, data) {
  if (error) {
    console.log(error, error.stack);

    if (data) {
      console.log('data:', data);
    }
  }
}
