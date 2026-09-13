/* Lumen live configuration.
   Seeds the app with the hosted Supabase project (project: lumen-study, region ap-south-1)
   so the site works on zenvx.in with no manual setup. The anon key is designed to be public;
   Row Level Security is what protects the data. Users can still override this in Settings. */
(function () {
  var SUPABASE = {
    url: 'https://myexcvqjnisvshxyvuww.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZXhjdnFqbmlzdnNoeHl2dXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNzc0MzUsImV4cCI6MjEwNDg1MzQzNX0.CIunBtvea-JVcENjzOwURU4hF146GPpm6OSazRwymmE',
  }
  window.LUMEN_SUPABASE = SUPABASE
  try {
    var saved = localStorage.getItem('lumen.sb')
    if (!saved) localStorage.setItem('lumen.sb', JSON.stringify(SUPABASE))
  } catch (e) {}
})()
