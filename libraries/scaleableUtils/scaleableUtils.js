export const parseQueryParams = () => {
  const params = {};
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
  const urlParams = new URLSearchParams(window.location.search);
  keys.forEach(key => {
    const val = urlParams.get(key);
    if (val) params[key] = val;
  });
  return params;
};

export const getAuctionMetadata = () => {
  return {
    url: window.location.href,
    referrer: document.referrer || null,
    userAgent: navigator.userAgent || null,
    language: navigator.language || null,
    screenWidth: window.screen.width || null,
    screenHeight: window.screen.height || null,
    utmParams: parseQueryParams(),
    prebidVersion: '$prebid.version$' || null,
    timestamp: Date.now()
  };
};

export const ensureAdUnitSlot = (auction, adUnitCode) => {
  if (!auction.adUnits[adUnitCode]) {
    auction.adUnits[adUnitCode] = {
      bids: [],
    };
  }
};
