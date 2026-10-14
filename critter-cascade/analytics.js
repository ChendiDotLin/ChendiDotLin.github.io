(function () {
  'use strict';
  // This standalone page does not use Jekyll's shared head. Match _config.yml.
  // Local previews must not generate real visits, and layout/language changes
  // must not reinitialize the tag or count as additional page views.
  if (location.protocol !== 'https:' || !['chendilin.com', 'www.chendilin.com'].includes(location.hostname)) return;
  if (window.critterAnalyticsLoaded) return;
  window.critterAnalyticsLoaded = true;
  const measurementId = 'G-1WHG4EGXB3';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_title: 'Critter Cascade',
    page_location: location.origin + location.pathname
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.append(script);
})();
