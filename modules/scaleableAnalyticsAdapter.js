/* COPYRIGHT SCALEABLE LLC 2019 */

import { ajax } from '../src/ajax.js';
import { EVENTS } from '../src/constants.js';
import adapter from '../libraries/analyticsAdapter/AnalyticsAdapter.js';
import adapterManager from '../src/adapterManager.js';
import { logMessage } from '../src/utils.js';
import { getAuctionMetadata } from '../libraries/scaleableUtils/scaleableUtils.js';

const BID_TIMEOUT = EVENTS.BID_TIMEOUT;
const AUCTION_INIT = EVENTS.AUCTION_INIT;
const BID_REQUESTED = EVENTS.BID_REQUESTED;
const BID_RESPONSE = EVENTS.BID_RESPONSE;
const BID_WON = EVENTS.BID_WON;
const AUCTION_END = EVENTS.AUCTION_END;

const URL = 'http://localhost:8061/api/track/auction';
// const URL = 'https://auction.scaleable.ai/';
const ANALYTICS_TYPE = 'endpoint';
const FLUSH_TIMEOUT = 2100;
const TIMEOUT_REFS = {};

let auctionData = {};

let scaleableAnalytics = Object.assign({},
  adapter({
    URL,
    ANALYTICS_TYPE
  }),
  {
    // Override AnalyticsAdapter functions by supplying custom methods
    track({ eventType, args }) {
      switch (eventType) {
        case AUCTION_INIT:
          onAuctionInit(args);
          break;
        case AUCTION_END:
          onAuctionEnd(args);
          break;
        case BID_WON:
          onBidWon(args);
          break;
        case BID_REQUESTED:
          onBidRequested(args);
          break;
        case BID_RESPONSE:
          onBidResponse(args);
          break;
        case BID_TIMEOUT:
          onBidTimeout(args);
          break;
        default:
          break;
      }
    }
  }
);

scaleableAnalytics.config = {};
scaleableAnalytics.originEnableAnalytics = scaleableAnalytics.enableAnalytics;
scaleableAnalytics.enableAnalytics = config => {
  scaleableAnalytics.config = config;

  scaleableAnalytics.originEnableAnalytics(config);

  scaleableAnalytics.enableAnalytics = function _enable() {
    return logMessage(`Analytics adapter for "${global}" already enabled, unnecessary call to \`enableAnalytics\`.`);
  };
}

scaleableAnalytics.getAuctionData = () => {
  return auctionData;
};

const finalizeAuction = (auctionId, timeoutReached) => {
  const auction = auctionData[auctionId];
  if (!auction || auction._flushed) {
    // TODO: Log Error if auction is undefined
    return;
  }

  auction.timeoutReached = !!timeoutReached;
  auction._flushed = true;

  sendDataToServer(auction);
};

const sendDataToServer = data => ajax(URL, () => {}, JSON.stringify(data));

// Event Tracking

// Track auction initiated
const onAuctionInit = args => {
  const scaleableConfig = scaleableAnalytics.config || {options: {}};
  const {adUnits, auctionId, bidderRequests, timestamp} = args;

  // Set Initial data for this auction
  auctionData[auctionId] = {
    auctionId,
    startTime: timestamp,
    status: 'started',
    site: scaleableConfig.options.site,
    adUnits: {},
    metadata: getAuctionMetadata()
  };

  const auction = auctionData[auctionId];

  // Loop through ad units to fill the adUnits on the auction
  adUnits.forEach(adUnit => {
    const mediaTypes = Object.keys(adUnit.mediaTypes);

    auction.adUnits[adUnit.code] = {
      mediaTypes,
      bids: []
    }
  });

  // Loop through bidder requests
  bidderRequests.forEach((bidder) => {
    // Loop through all the bids of this bidder
    bidder.bids.forEach((bid) => {
      const {adUnitCode, bidder, params, requestId} = bid;
      const adUnit = auction.adUnits[adUnitCode];

      if (!adUnit) {
        // TODO: Log an error since we already added all the ad units
        return;
      }

      // Set Data for this bidder and the adunit
      adUnit.bids.push({
        bidder,
        params,
        requestId
      })
    });
  });
}

const onBidRequested = ({auctionId, bids}) => {
  bids.forEach(bid => {
    const adUnit = auctionData[auctionId].adUnits[bid.adUnitCode];
    if (!adUnit) {
      // TODO: LOG warning
      return;
    }

    let existingBid = adUnit.bids.find(b => b.requestId === bid.requestId);

    // Set properties for each bid (which should always exist)
    if (existingBid) {
      existingBid = {
        ...existingBid,
        isS2S: bid.src === 's2s',
        alias: bid.bidderCode !== bid.bidder ? bid.bidderCode : null,
        size: Array.isArray(bid.sizes) ? bid.sizes : [],
        timeRequested: Date.now(),
        status: 'requested'
      }
    }
  });
};

const onBidResponse = bid => {
  const { cpm, currency, netRevenue, creativeId, timeToRespond, width, height,
    ttl, mediaType, dealId, adId, floorData, originalCpm} = bid;
  const adUnit = auctionData[auctionId].adUnits[bid.adUnitCode];
  if (!adUnit) {
    // TODO: LOG warning
    return;
  }

  let existingBid = adUnit.bids.find(b => b.requestId === bid.requestId);

  // Set properties for each bid (which should always exist)
  if (!existingBid) {
    // TODO: LOG Error
    return;
  }
  

  existingBid = {
    ...existingBid,
    cpm,
    originalCpm,
    currency,
    netRevenue,
    creativeId,
    ttr: timeToRespond,
    width,
    height,
    ttl,
    mediaType,
    dealId,
    adId,
    status: 'responded',
    floorData
  };
};

// Handle all events besides requests and wins
const onAuctionEnd = auctionDetails => {
  const {auctionId, timeout} = auctionDetails;
  if (!auctionData[auctionId]) {
    // TODO: Log Error
    return;
  }

  // Set a few more attributes on the auction itself
  auctionData[auctionId].endTime = Date.now();
  auctionData[auctionId].timeout = timeout;
  auctionData[auctionId].status = 'ended';

  const adUnitCodes = Object.keys(auctionData[auctionId].adUnits);
  const wonAdUnitCodes = new Set();

  const checkAndFlush = () => {
    const allDone = adUnitCodes.every(code => wonAdUnitCodes.has(code));
    if (allDone) {
      finalizeAuction(auctionId);
      clearTimeout(TIMEOUT_REFS[auctionId]);
    }
  };

  // Only wait 2 seconds for Bid Won events
  TIMEOUT_REFS[auctionId] = setTimeout(() => {
    finalizeAuction(auctionId, true);
  }, FLUSH_TIMEOUT);

  // Set a function on auction for when Bid Won events come back to see if we can flush early
  auctionData[auctionId]._onBidWon = (adUnitCode) => {
    wonAdUnitCodes.add(adUnitCode);
    checkAndFlush();
  }
};

// Bid Win Events occur after auction end
const onBidWon = bid => {
  const auction = auctionData[auctionId];
  if (auction._flushed) {
    // TODO: Call endpoint to record missed WINs
  }

  const adUnit = auction.adUnits[bid.adUnitCode];
  if (!adUnit) {
    // TODO: LOG warning
    return;
  }

  let existingBid = adUnit.bids.find(b => b.requestId === bid.requestId);

  // Set properties for each bid (which should always exist)
  if (!existingBid) {
    // TODO: LOG Error
    return;
  }

  existingBid = {
    ...existingBid,
    status: 'won',
    floorData: bid.floorData || existingBid.floorData,
    dealId: bid.dealId || existingBid.dealId,
    adServerTargeting: {
      hb_pb: bid.adServerTargeting.hb_pb,
      hb_bidder: bid.adServerTargeting.hb_bidder,
      hb_deal: bid.adServerTargeting.hb_deal
    }
  };

  // If auction has ended, check if we can flush events
  if (auction._onBidWon) {
    auction._onBidWon(bid.adUnitCode)
  }
}

const onBidTimeout = timeouts => {
  timeouts.forEach(timeout => {
    const adUnit = auctionData[timeout.auctionId].adUnits[timeout.adUnitCode];
    if (!adUnit) {
      // TODO: LOG warning
      return;
    }

    let existingBid = adUnit.bids.find(b => b.requestId === timeout.requestId);

    // Set properties for each bid (which should always exist)
    if (!existingBid) {
      // TODO: LOG Error
      return;
    }

    existingBid = {
      ...existingBid,
      timeout: timeout.timeout,
      status: 'timeout'
    }
  });
}

adapterManager.registerAnalyticsAdapter({
  adapter: scaleableAnalytics,
  code: 'scaleable'
})

export default scaleableAnalytics;
