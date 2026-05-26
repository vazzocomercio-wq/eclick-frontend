/**
 * StorefrontPixels — injeta scripts de tracking no <head> via SSR.
 *
 * Suporta:
 *  - Google Analytics 4 (G-XXXXXX)
 *  - Meta Pixel (Facebook)
 *  - TikTok Pixel
 *  - Google Tag Manager (GTM-XXXX)
 *
 * Cada um e opcional — so renderiza se o ID estiver definido no
 * store_config. Server Component (zero JS no bundle do cliente).
 */

import type { StorefrontStore } from '@/lib/storefront/v3/data'

interface Props {
  store: StorefrontStore
}

// IDs de pixel são interpolados em <script> inline (dangerouslySetInnerHTML).
// Validamos por allowlist estrita pra impedir XSS armazenado via store_config
// (ex.: meta_pixel_id = "');<script>...">). Real IDs são só [A-Za-z0-9_-].
const PIXEL_ID_RE = /^[A-Za-z0-9_-]{1,64}$/
function safePixelId(v?: string | null): string | null {
  const s = (v ?? '').trim()
  return s && PIXEL_ID_RE.test(s) ? s : null
}

export function StorefrontPixels({ store }: Props) {
  const ga       = safePixelId(store.google_analytics_id)
  const meta     = safePixelId(store.meta_pixel_id)
  const tiktok   = safePixelId(store.tiktok_pixel_id)
  const gtm      = safePixelId(store.gtm_id)

  if (!ga && !meta && !tiktok && !gtm) return null

  return (
    <>
      {/* Google Analytics 4 */}
      {ga && (
        <>
          <script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} async />
          <script
            dangerouslySetInnerHTML={{ __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga}');
            ` }}
          />
        </>
      )}

      {/* Google Tag Manager */}
      {gtm && (
        <script
          dangerouslySetInnerHTML={{ __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
            var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
            j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtm}');
          ` }}
        />
      )}

      {/* Meta Pixel */}
      {meta && (
        <script
          dangerouslySetInnerHTML={{ __html: `
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
            n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
            t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${meta}');
            fbq('track', 'PageView');
          ` }}
        />
      )}

      {/* TikTok Pixel */}
      {tiktok && (
        <script
          dangerouslySetInnerHTML={{ __html: `
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
              ttq.load('${tiktok}');
              ttq.page();
            }(window, document, 'ttq');
          ` }}
        />
      )}
    </>
  )
}
