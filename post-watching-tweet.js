var config = require('./config/config');
var callNextTick = require('call-next-tick');
var Twit = require('twit');
var async = require('async');
var fetchHeadlines = require('fetch-headlines');
var _ = require('lodash');
var probable = require('probable');
var cheerio = require('cheerio');
var level = require('level');

var keyPhrase = 'is watching closely';
var emphasizedString = '<b>' + keyPhrase + '</b>';
var watcherRegex = /[\.!\?;] (.*)is watching closely/i;
var htmlTagRegex = /\<\/?\w+>/g;
var shortenedLinkLength = 23;

var chosenLink;

var dryRun = false;
if (process.argv.length > 2) {
  dryRun = (process.argv[2].toLowerCase() == '--dry');
}

var db;

var twit = new Twit(config.twitter);

async.waterfall(
  [
    openDb,
    saveDb,
    startFetch,
    distillNewsItems,
    pickItem,
    postTweet
  ],
  wrapUp
);

function openDb(done) {
  var dbOpts = {
    valueEncoding: 'utf8'
  };
  level(__dirname + '/data/used-links.db', dbOpts, done);
}

function saveDb(theDB, done) {
  db = theDB;
  callNextTick(done);
}

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
  if (items.length < 1) {
    callNextTick(done, new Error('No unused stories found.'));
    return;
  }

  var shuffledItems = probable.shuffle(items);
  var item = shuffledItems[0];
  db.get(getActualNewsLink(item.link), useUnusedItem);

  function useUnusedItem(error, foundLink) {
    if (error && error.notFound) {
      chosenLink = getActualNewsLink(item.link);
      done(null, item);
    }
    else {
      console.log(item.link, 'already used. Picking something else.');
      callNextTick(pickItem, shuffledItems.slice(1), done);
    }
  }
}

function postTweet(item, done) {
  var attribution = ' ' + item.link;

  var text = item.keySentence.slice(0, 140 - shortenedLinkLength - 2);
  text = text.replace(keyPhrase, keyPhrase.toUpperCase());
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
  else if (chosenLink) {
    db.put(chosenLink, true, cleanUp);
  }
}

function cleanUp(error) {
  if (error) {
    console.log(error);
  }

  db.close(sayOK);
}

function sayOK() {
  console.log('OK, database closed.');
}

function getActualNewsLink(link) {
  var actualNewsLink;
  var parts = link.split('url=');
  if (parts.length > 1) {
    actualNewsLink = parts[1];
  }
  return actualNewsLink;
}
