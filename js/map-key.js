// map-key.js - the one copy of the CARTO map key, for the Tour Map and the Passport map.
// Load it before js/tour-map.js and js/passport.js.
//
// CARTO basemaps need a key since Sept 2026 (free non-commercial tier, 5M tiles/month).
// Public by design - it ships in every tile URL. Without it every tile reads "API KEY
// REQUIRED" (checked 2026-11-01). Manage at dashboard.basemaps.carto.com (jd@tthpods.com).
window.TTH_CARTO_KEY = 'cb1_4wzs_1_6486b4aebf6d574862008dc4';
