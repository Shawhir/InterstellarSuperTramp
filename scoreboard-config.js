// Online scoreboard settings for the public web version.
// Leave these empty to keep the scoreboard off. To switch it on, create a free
// Supabase project, run the SQL in README.md, then paste the project's URL and
// its "anon public" key here. The anon key is meant to be public; the table's
// row-level security only allows reading scores and adding new ones.
window.SUPERTRAMP_SCOREBOARD = {
  // Address of the Cloudflare Worker in worker/ (lets players post with just a
  // name). Leave empty to post through GitHub issues instead.
  workerUrl: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
};
