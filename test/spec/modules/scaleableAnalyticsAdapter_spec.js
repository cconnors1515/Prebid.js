import scaleableAnalytics from 'modules/scaleableAnalyticsAdapter.js';
import { expect } from 'chai';
import * as events from 'src/events.js';
import { EVENTS } from 'src/constants.js';
import { server } from 'test/mocks/xhr.js';

const BID_TIMEOUT = EVENTS.BID_TIMEOUT;
const AUCTION_INIT = EVENTS.AUCTION_INIT;
const BID_REQUESTED = EVENTS.BID_REQUESTED;
const BID_RESPONSE = EVENTS.BID_RESPONSE;
const BID_WON = EVENTS.BID_WON;
const AUCTION_END = EVENTS.AUCTION_END;

const START_TIME = 1750296000569;
const REQUEST_TIME = START_TIME + 100;
const END_TIME = REQUEST_TIME + 4901;

const AUCTION_ID = '123-456';
const AD_UNIT_SLOT = 'ad-slot-1';
const SITE = '5c4fab7a829e955d6c265e72';
const ENDPOINT = 'http://localhost:8061/api/track/auction';

describe('Scaleable Analytics Adapter', function() {
  const MOCKS = {
    AUCTION_INIT: {
      auctionId: AUCTION_ID,
      timeout: 5000,
      timestamp: START_TIME,
      adUnitCodes: [AD_UNIT_SLOT],
      adUnits: [{
        code: AD_UNIT_SLOT,
        mediaTypes: {
          banner: {
            sizes: [[300, 250]]
          }
        },
        bids: [
          { bidder: 'mockBidder', bidderCode: "mockBidder", bidId: '1dff', params: {test: 'value'} },
          { bidder: 'mockBidder2', bidderCode: "mockBidder2Alias", bidId: '2eaa', params: {test2: 'value2'} },
          { bidder: 'mockBidder3', bidderCode: "mockBidder3", bidId: 'bid789', params: { test3: 'value3' } }  // timed out
        ]
      }],
      bidderRequests: [{
        bids: [
        {
          adUnitCode: AD_UNIT_SLOT,
          bidder: 'mockBidder',
          bidderCode: "mockBidder",
          params: {
            test: 'value'
          },
          bidId: '1dff'
        },
        {
          adUnitCode: AD_UNIT_SLOT,
          bidder: 'mockBidder2',
          bidderCode: "mockBidder2Alias",
          params: {
            test2: 'value2'
          },
          bidId: '2eaa'
        },
        {
          adUnitCode: AD_UNIT_SLOT,
          bidder: 'mockBidder3',
          bidderCode: 'mockBidder3',
          params: { test3: 'value3' },
          bidId: '3fgh'
        }
      ]
      }],
      site: SITE,
    },
    BID_REQUESTED: [
      {
        auctionId: AUCTION_ID,
        bidder: 'mockBidder',
        bidderRequestId: 'req-1',
        bids: [
          {
            adUnitCode: AD_UNIT_SLOT,
            bidId: '1dff',
            bidder: 'mockBidder',
            bidderCode: "mockBidder",
            params: { test: 'value' },
            sizes: [[300, 250]]
          }
        ],
        start: 1750296000570,
        timeout: 5000
      },
      {
        auctionId: AUCTION_ID,
        bidder: 'mockBidder2',
        bidderRequestId: 'req-2',
        bids: [
          {
            adUnitCode: AD_UNIT_SLOT,
            bidId: '2eaa',
            bidder: 'mockBidder2',
            bidderCode: "mockBidder2Alias",
            params: { test2: 'value2' },
            sizes: [[300, 250]]
          }
        ],
        start: 1750296000571,
        timeout: 5000
      },
      {
        auctionId: AUCTION_ID,
        bidder: 'mockBidder3',
        bidderRequestId: 'req-3',
        bids: [
          {
            adUnitCode: AD_UNIT_SLOT,
            bidId: '3fgh',
            bidder: 'mockBidder3',
            bidderCode: "mockBidder3",
            params: { test3: 'value3' },
            sizes: [[300, 250]]
          }
        ],
        start: 1750296000572,
        timeout: 5000
      },
    ],
    BID_RESPONSE: [
      {
        adId: '1dff',
        adUnitCode: AD_UNIT_SLOT,
        auctionId: AUCTION_ID,
        bidder: 'mockBidder',
        bidderCode: 'mockBidder',
        cpm: 1.25,
        currency: 'USD',
        creativeId: 'creative-1',
        width: 300,
        height: 250,
        requestId: '1dff',
        mediaType: 'banner',
        netRevenue: true,
        ttl: 300,
        timeToRespond: 120,
        ad: '<div>Mock Ad 1</div>',
        originalCpm: 1.50,
        meta: {
          advertiserDomains: ['mockadvertiser.com']
        },
        floorData: {
          floorValue: 0.80,
          floorRule: '/300x250/banner',
          floorCurrency: 'USD',
          matchedFields: {
            mediaType: 'banner',
            size: '300x250'
          }
        }
      },
      {
        adId: '2eaa',
        adUnitCode: AD_UNIT_SLOT,
        auctionId: AUCTION_ID,
        bidder: 'mockBidder2',
        bidderCode: 'mockBidder2Alias', // Alias matches mockBidder2's alias
        cpm: 1.15,
        currency: 'USD',
        creativeId: 'creative-2',
        dealId: 'deal-test',
        width: 300,
        height: 250,
        requestId: '2eaa',
        mediaType: 'banner',
        netRevenue: true,
        ttl: 300,
        timeToRespond: 135,
        ad: '<div>Mock Ad 2</div>',
        originalCpm: 1.15,
        meta: {
          advertiserDomains: ['aliasadvertiser.com']
        }
      }
    ],
    BID_TIMEOUT: [
      {
        bidId: '3fgh',
        auctionId: AUCTION_ID,
        adUnitCode: AD_UNIT_SLOT,
        bidder: 'mockBidder3'
      }
    ],
    AUCTION_END: {
      auctionId: AUCTION_ID,
      timeout: 5000,
    },
    BID_WON: {
      auctionId: AUCTION_ID,
      adserverTargeting: {
        hb_bidder: 'mockBidder',
        hb_adid: '1dff',
        hb_pb: '1.20',
        hb_size: '300x250',
        hb_format: 'banner'
      },
      adUnitCode: AD_UNIT_SLOT,
      floorData: {
        floorValue: 0.90,
        floorCurrency: 'USD',
        matchedFields: {
          mediaType: 'banner',
          size: '300x250'
        },
      },
      requestId: '1dff'
    }
  }

  const EXPECTED = {
    AUCTION_INIT: {
      "123-456": {
        auctionId: "123-456",
        startTime: START_TIME,
        status: "started",
        site: SITE,
        timeout: 5000,
        adUnits: {
          "ad-slot-1": {
            mediaTypes: ["banner"],
            bids: [
              {
                bidder: "mockBidder",
                params: {
                  test: "value"
                },
                requestId: "1dff"
              },
              {
                bidder: "mockBidder2",
                params: {
                  test2: "value2"
                },
                requestId: "2eaa"
              },
              {
                bidder: "mockBidder3",
                params: {
                  test3: "value3"
                },
                requestId: "3fgh"
              }
            ]
          }
        },
        metadata: { // Not checking this in the Test
          // language: "en-US",
          // prebidVersion: "$prebid.version$",
          // referrer: "http://localhost:9876/?id=21549722",
          // screenHeight: 600,
          // screenWidth: 800,
          // timestamp: 1750296000574,
          // url: "http://localhost:9876/context.html",
          // userAgent:
          //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/137.0.0.0 Safari/537.36",
          // utmParams: {}
        }
      }
    },
    BID_REQUESTED: {
      "123-456": {
        auctionId: "123-456",
        startTime: START_TIME,
        status: "started",
        site: SITE,
        timeout: 5000,
        adUnits: {
          "ad-slot-1": {
            mediaTypes: ["banner"],
            bids: [
              {
                alias: null,
                bidder: "mockBidder",
                isS2S: false,
                params: {
                  test: "value"
                },
                size: [[300, 250]],
                status: 'requested',
                timeRequested: REQUEST_TIME,
                requestId: "1dff"
              },
              {
                alias: 'mockBidder2Alias',
                bidder: "mockBidder2",
                isS2S: false,
                params: {
                  test2: "value2"
                },
                size: [[300, 250]],
                status: 'requested',
                timeRequested: REQUEST_TIME,
                requestId: "2eaa"
              },
              {
                alias: null,
                bidder: "mockBidder3",
                isS2S: false,
                params: {
                  test3: "value3"
                },
                size: [[300, 250]],
                status: 'requested',
                timeRequested: REQUEST_TIME,
                requestId: "3fgh"
              },
            ]
          }
        },
        metadata: {}
      }
    },
    BID_RESPONSE: {
      "123-456": {
        auctionId: "123-456",
        startTime: START_TIME,
        status: "started",
        site: SITE,
        timeout: 5000,
        adUnits: {
          "ad-slot-1": {
            mediaTypes: ["banner"],
            bids: [
              {
                adId: '1dff',
                alias: null,
                bidder: "mockBidder",
                cpm: 1.25,
                creativeId: "creative-1",
                currency: 'USD',
                dealId: null,
                floorData: {
                  floorValue: 0.80,
                  floorRule: '/300x250/banner',
                  floorCurrency: 'USD',
                  matchedFields: {
                    mediaType: 'banner',
                    size: '300x250'
                  }
                },
                height: 250,
                isS2S: false,
                mediaType: 'banner',
                netRevenue: true,
                originalCpm: 1.5,
                params: {
                  test: "value"
                },
                requestId: "1dff",
                size: [[300, 250]],
                status: 'responded',
                timeRequested: REQUEST_TIME,
                ttl: 300,
                ttr: 120,
                width: 300,
              },
              {
                adId: '2eaa',
                alias: 'mockBidder2Alias',
                bidder: "mockBidder2",
                cpm: 1.15,
                creativeId: 'creative-2',
                currency: 'USD',
                dealId: 'deal-test',
                floorData: null,
                height: 250,
                isS2S: false,
                mediaType: 'banner',
                netRevenue: true,
                originalCpm: 1.15,
                params: {
                  test2: "value2"
                },
                requestId: "2eaa",
                size: [[300, 250]],
                status: 'responded',
                timeRequested: REQUEST_TIME,
                ttl: 300,
                ttr: 135,
                width: 300,
              },
              {
                alias: null,
                bidder: "mockBidder3",
                isS2S: false,
                params: {
                  test3: "value3"
                },
                size: [[300, 250]],
                status: 'requested',
                timeRequested: REQUEST_TIME,
                requestId: "3fgh"
              },
            ]
          }
        },
        metadata: {}
      }
    },
    BID_TIMEOUT: {
      "123-456": {
        auctionId: "123-456",
        startTime: START_TIME,
        status: "started",
        site: SITE,
        timeout: 5000,
        adUnits: {
          "ad-slot-1": {
            mediaTypes: ["banner"],
            bids: [
              {
                adId: '1dff',
                alias: null,
                bidder: "mockBidder",
                cpm: 1.25,
                creativeId: "creative-1",
                currency: 'USD',
                dealId: null,
                floorData: {
                  floorValue: 0.80,
                  floorRule: '/300x250/banner',
                  floorCurrency: 'USD',
                  matchedFields: {
                    mediaType: 'banner',
                    size: '300x250'
                  }
                },
                height: 250,
                isS2S: false,
                mediaType: 'banner',
                netRevenue: true,
                originalCpm: 1.5,
                params: {
                  test: "value"
                },
                requestId: "1dff",
                size: [[300, 250]],
                status: 'responded',
                timeRequested: REQUEST_TIME,
                ttl: 300,
                ttr: 120,
                width: 300,
              },
              {
                adId: '2eaa',
                alias: 'mockBidder2Alias',
                bidder: "mockBidder2",
                cpm: 1.15,
                creativeId: 'creative-2',
                currency: 'USD',
                dealId: 'deal-test',
                floorData: null,
                height: 250,
                isS2S: false,
                mediaType: 'banner',
                netRevenue: true,
                originalCpm: 1.15,
                params: {
                  test2: "value2"
                },
                requestId: "2eaa",
                size: [[300, 250]],
                status: 'responded',
                timeRequested: REQUEST_TIME,
                ttl: 300,
                ttr: 135,
                width: 300,
              },
              {
                alias: null,
                bidder: "mockBidder3",
                isS2S: false,
                params: {
                  test3: "value3"
                },
                size: [[300, 250]],
                status: 'timeout',
                timeout: null,
                timeRequested: REQUEST_TIME,
                requestId: "3fgh"
              },
            ]
          }
        },
        metadata: {}
      }
    },
    AUCTION_END: {
      "123-456": {
        auctionId: "123-456",
        startTime: START_TIME,
        endTime: END_TIME,
        status: "ended",
        site: SITE,
        timeout: 5000,
        adUnits: {
          "ad-slot-1": {
            mediaTypes: ["banner"],
            bids: [
              {
                adId: '1dff',
                alias: null,
                bidder: "mockBidder",
                cpm: 1.25,
                creativeId: "creative-1",
                currency: 'USD',
                dealId: null,
                floorData: {
                  floorValue: 0.80,
                  floorRule: '/300x250/banner',
                  floorCurrency: 'USD',
                  matchedFields: {
                    mediaType: 'banner',
                    size: '300x250'
                  }
                },
                height: 250,
                isS2S: false,
                mediaType: 'banner',
                netRevenue: true,
                originalCpm: 1.5,
                params: {
                  test: "value"
                },
                requestId: "1dff",
                size: [[300, 250]],
                status: 'responded',
                timeRequested: REQUEST_TIME,
                ttl: 300,
                ttr: 120,
                width: 300,
              },
              {
                adId: '2eaa',
                alias: 'mockBidder2Alias',
                bidder: "mockBidder2",
                cpm: 1.15,
                creativeId: 'creative-2',
                currency: 'USD',
                dealId: 'deal-test',
                floorData: null,
                height: 250,
                isS2S: false,
                mediaType: 'banner',
                netRevenue: true,
                originalCpm: 1.15,
                params: {
                  test2: "value2"
                },
                requestId: "2eaa",
                size: [[300, 250]],
                status: 'responded',
                timeRequested: REQUEST_TIME,
                ttl: 300,
                ttr: 135,
                width: 300,
              },
              {
                alias: null,
                bidder: "mockBidder3",
                isS2S: false,
                params: {
                  test3: "value3"
                },
                size: [[300, 250]],
                status: 'timeout',
                timeout: null,
                timeRequested: REQUEST_TIME,
                requestId: "3fgh"
              },
            ]
          }
        },
        metadata: {}
      }
    },
    BID_WON: {
      "123-456": {
        _flushed: true,
        _onBidWon: null,
        auctionId: "123-456",
        startTime: START_TIME,
        endTime: END_TIME,
        status: "ended",
        site: SITE,
        timeout: 5000,
        timeoutReached: false,
        adUnits: {
          "ad-slot-1": {
            mediaTypes: ["banner"],
            bids: [
              {
                adId: '1dff',
                adserverTargeting: {
                  hb_bidder: 'mockBidder',
                  hb_deal: null,
                  hb_pb: "1.20",
                },
                alias: null,
                bidder: "mockBidder",
                cpm: 1.25,
                creativeId: "creative-1",
                currency: 'USD',
                dealId: null,
                floorData: {
                  floorValue: 0.9,
                  floorCurrency: 'USD',
                  matchedFields: {
                    mediaType: 'banner',
                    size: '300x250'
                  }
                },
                height: 250,
                isS2S: false,
                mediaType: 'banner',
                netRevenue: true,
                originalCpm: 1.5,
                params: {
                  test: "value"
                },
                requestId: "1dff",
                size: [[300, 250]],
                status: 'won',
                timeRequested: REQUEST_TIME,
                ttl: 300,
                ttr: 120,
                width: 300,
              },
              {
                adId: '2eaa',
                alias: 'mockBidder2Alias',
                bidder: "mockBidder2",
                cpm: 1.15,
                creativeId: 'creative-2',
                currency: 'USD',
                dealId: 'deal-test',
                floorData: null,
                height: 250,
                isS2S: false,
                mediaType: 'banner',
                netRevenue: true,
                originalCpm: 1.15,
                params: {
                  test2: "value2"
                },
                requestId: "2eaa",
                size: [[300, 250]],
                status: 'responded',
                timeRequested: REQUEST_TIME,
                ttl: 300,
                ttr: 135,
                width: 300,
              },
              {
                alias: null,
                bidder: "mockBidder3",
                isS2S: false,
                params: {
                  test3: "value3"
                },
                size: [[300, 250]],
                status: 'timeout',
                timeout: null,
                timeRequested: REQUEST_TIME,
                requestId: "3fgh"
              },
            ]
          }
        },
        metadata: {}
      }
    }
  }

  describe('Event Handling', function() {
    let clock;
    let sandbox;

    beforeEach(function() {
      sandbox = sinon.createSandbox();
      sandbox.stub(events, 'getEvents').returns([]);
      clock = sandbox.useFakeTimers(1750296000569);

      scaleableAnalytics.enableAnalytics({
        provider: 'scaleable',
        options: {
          site: SITE
        }
      });
    });

    afterEach(function() {
      sandbox.restore();
      scaleableAnalytics.disableAnalytics();
    });

    it('should handle the auction init event', function(done) {
      events.emit(AUCTION_INIT, MOCKS.AUCTION_INIT);

      const actual = scaleableAnalytics.getAuctionData();

      // Strip out the metadata for testing
      actual[AUCTION_ID].metadata = {};

      expect(actual).to.deep.equal(EXPECTED.AUCTION_INIT);

      done();
    });

    it('should handle the bid requested event', function(done) {
      clock.tick(100);
      events.emit(BID_REQUESTED, MOCKS.BID_REQUESTED[0]);
      events.emit(BID_REQUESTED, MOCKS.BID_REQUESTED[1]);
      events.emit(BID_REQUESTED, MOCKS.BID_REQUESTED[2]);

      const actual = scaleableAnalytics.getAuctionData();

      expect(actual).to.deep.equal(EXPECTED.BID_REQUESTED);

      done();
    });

    it('should handle the bid response event', function(done) {
      events.emit(BID_RESPONSE, MOCKS.BID_RESPONSE[0]);
      events.emit(BID_RESPONSE, MOCKS.BID_RESPONSE[1]);

      const actual = scaleableAnalytics.getAuctionData();

      expect(actual).to.deep.equal(EXPECTED.BID_RESPONSE);

      done();
    });

    it('should handle the bid timeout event', function(done) {
      events.emit(BID_TIMEOUT, MOCKS.BID_TIMEOUT);

      const actual = scaleableAnalytics.getAuctionData();

      expect(actual).to.deep.equal(EXPECTED.BID_TIMEOUT);

      done();
    });

    it('should handle the auction end event', function(done) {
      clock.tick(5001);
      events.emit(AUCTION_END, MOCKS.AUCTION_END);

      const actual = scaleableAnalytics.getAuctionData();

      expect({...actual[AUCTION_ID], _onBidWon: null}).to.deep.equal({...EXPECTED.AUCTION_END[AUCTION_ID], _onBidWon: null});

      done();
    });

    it('should handle the bid won event', function(done) {
      events.emit(BID_WON, MOCKS.BID_WON);

      // Since this is a valid bid win and there is only one event, we should flush the auction now
      expect(server.requests.length).to.equal(1);
      expect(server.requests[0].url).to.equal(ENDPOINT);

      const actual = scaleableAnalytics.getAuctionData();

      expect({...actual[AUCTION_ID], _onBidWon: null}).to.deep.equal({...EXPECTED.BID_WON[AUCTION_ID], _onBidWon: null});

      done();
    });
  });
});
