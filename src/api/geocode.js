import * as Sentry from "@sentry/react";
import qs from 'query-string';
import { WebMercatorViewport } from 'react-map-gl';

export const MAPBOX_TOKEN = 'pk.eyJ1IjoiY29tbWFhaSIsImEiOiJjangyYXV0c20wMGU2NDluMWR4amUydGl5In0.6Vb11S6tdX6Arpj6trRE_g'
const HERE_API_KEY = 'FzdKQBdDlWNQfvlvreB9ukezD-fYi7uKW0rM_K9eE2E'

const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mbxDirections = require('@mapbox/mapbox-sdk/services/directions');

let geocodingClient = mbxGeocoding({ accessToken: MAPBOX_TOKEN });;
let directionsClient = mbxDirections({ accessToken: MAPBOX_TOKEN });;

export default function geocodeApi() {
  function getFilteredContexts(context) {
    const include_ctxs = ['region', 'district', 'place', 'locality', 'neighborhood'];
    return context.filter((ctx) => {
      return include_ctxs.some((c) => ctx.id.indexOf(c) !== -1);
    });
  }

  function getContextString(context) {
    if (context.id.indexOf('region') !== -1 && context.short_code) {
      if (context.short_code.indexOf('US-') !== -1) {
        return context.short_code.substr(3);
      }
      return context.short_code;
    }
    return context.text;
  }

  function priorityGetContext(contexts) {
    for (const prio of ['place', 'locality', 'district']) {
      for (const ctx of contexts) {
        if (ctx.id.indexOf(prio) !== -1) {
          return ctx;
        }
      }
    }
  }

  return {
    async reverseLookup(coords) {
      if (geocodingClient === null || (coords[0] === 0 && coords[1] === 0)) {
        return null;
      }

      const endpoint = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
      const params = {
        access_token: MAPBOX_TOKEN,
        limit: 1,
      };

      let resp;
      try {
        resp = await fetch(`${endpoint}${coords[0]},${coords[1]}.json?${qs.stringify(params)}`, {
          method: 'GET',
          cache: 'force-cache',
        });
        if (!resp.ok) {
          return null;
        }
      } catch (err) {
        console.log(err);
        return null;
      }

      try {
        const { features } = await resp.json();
        if (features.length && features[0].context) {
          let contexts = getFilteredContexts(features[0].context);
          let place = '';
          let details = '';
          if (contexts.length > 0) {
            place = getContextString(contexts.shift());
          }
          if (contexts.length > 0) {
            details = getContextString(contexts.pop());
          }
          if (contexts.length > 0) {
            details = `${getContextString(priorityGetContext(contexts))}, ${details}`;
          }
          return { place, details };
        }
      } catch (err) {
        Sentry.captureException(err, { fingerprint: 'geocode_reverse_parse' });
      }
    },

    async forwardLookup(query, proximity, viewport) {
      let params = {
        apiKey: HERE_API_KEY,
        q: query,
        limit: 20,
        details: '1',
      };
      if (proximity) {
        params.at = `${proximity[1]},${proximity[0]}`;
      } else if (viewport) {
        const bbox = new WebMercatorViewport(viewport).getBounds();
        let vals = [
          Math.max(-180, bbox[0][0]),
          Math.max(-90,  bbox[0][1]),
          Math.min( 180, bbox[1][0]),
          Math.min( 90,  bbox[1][1]),
        ];
        params.in = 'bbox:' + vals.join(',');
      } else {
        params.in = 'bbox:-180,-90,180,90';
      }

      const resp = await fetch(`https://autosuggest.search.hereapi.com/v1/autosuggest?${qs.stringify(params)}`, {
        method: 'GET',
      });
      if (!resp.ok) {
        console.log(resp);
        return [];
      }

      const json = await resp.json();
      return json.items;
    },

    async networkPositioning(req) {
      const resp = await fetch(`https://positioning.hereapi.com/v2/locate?apiKey=${HERE_API_KEY}&fallback=any,singleWifi`, {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(req),
      });
      if (!resp.ok) {
        console.log(resp);
        return null;
      }
      const json = await resp.json();
      return json.location;
    },

    async getDirections(points) {
      if (!directionsClient) {
        return null;
      }

      const resp = await directionsClient.getDirections({
        profile: 'driving-traffic',
        waypoints: points.map((p) => { return { coordinates: p }; }),
        annotations: ['distance', 'duration'],
        geometries: 'geojson',
        overview: 'full',
      }).send();

      return resp.body.routes;
    },
  };
}
