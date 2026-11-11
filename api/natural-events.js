// NASA EONET v3 public natural-event feed, no key required.
// Event geometry may be points or polygons; return a conservative point summary.
const CATEGORIES = new Set(['wildfires','severeStorms','volcanoes','floods','earthquakes','landslides','seaLakeIce','snow','dustHaze','drought','tempExtremes','waterColor','manmade']);
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const days = Number(params.get('days') || 14);
  if (!Number.isInteger(days) || days < 1 || days > 30) return Response.json({error:'days must be 1 to 30'}, {status:400});
  const category = params.get('category');
  if (category && !CATEGORIES.has(category)) return Response.json({error:'unsupported category'}, {status:400});
  const url = new URL('https://eonet.gsfc.nasa.gov/api/v3/events');
  url.searchParams.set('status','open');
  url.searchParams.set('days',String(days));
  url.searchParams.set('limit','250');
  if(category)url.searchParams.set('category',category);
  try {
    const upstream=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    if(!upstream.ok)throw Error('EONET HTTP '+upstream.status);
    const payload=await upstream.json();
    if(!Array.isArray(payload.events))throw Error('Invalid EONET response');
    const events=payload.events.map(e=>{
      const geometries=Array.isArray(e.geometry)?e.geometry:[];
      const latest=geometries.at(-1);
      let lon=null,lat=null;
      if(latest?.type==='Point' && Array.isArray(latest.coordinates)){
        [lon,lat]=latest.coordinates;
      }
      const valid=Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=90;
      return {
        id:String(e.id||'').slice(0,80),title:String(e.title||'').slice(0,240),
        categories:Array.isArray(e.categories)?e.categories.map(c=>String(c.title||c.id||'').slice(0,80)).slice(0,5):[],
        date:latest?.date||null,
        longitude:valid?lon:null,latitude:valid?lat:null,
        geometryType:latest?.type||null,
        link:typeof e.link==='string'&&e.link.startsWith('https://eonet.gsfc.nasa.gov/')?e.link:null,
      };
    });
    return Response.json({source:'NASA EONET',retrievedAt:new Date().toISOString(),days,category:category||null,count:events.length,events,note:'Open events only; point coordinates represent the most recent reported geometry, not an event boundary. Polygon-only events are not assigned invented points.'},{headers:{'Cache-Control':'public, s-maxage=300, stale-while-revalidate=600','X-Content-Type-Options':'nosniff'}});
  }catch{return Response.json({error:'NASA EONET temporarily unavailable'},{status:502,headers:{'Cache-Control':'no-store'}})}
}
