import { config } from '../../../config/config.js'

// Temporary non-prod assumption for BMD-1010. BMD-568 must replace this with
// the user's consent choice. Queue it before GTM's first event so the imported
// GA tag's analytics_storage check can pass; advertising remains denied.
export const googleAnalyticsConsentScript =
  "window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});"

// Supplied BMD-1010 snippet. Keep the script and its CSP hash in sync by
// sharing this static string; no request or user data is interpolated into it.
export const googleTagManagerScript =
  "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0], j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src= 'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f); })(window,document,'script','dataLayer','GTM-K5LRK3HR');"

const nonProductionEnvironments = new Set([
  'local',
  'dev',
  'test',
  'ext-test',
  'perf-test'
])

export function isGoogleTagManagerEnabled() {
  return (
    config.get('googleTagManager.enabled') &&
    nonProductionEnvironments.has(config.get('environment'))
  )
}
