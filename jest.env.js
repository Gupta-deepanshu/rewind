// Runs before every test file. next/jest loads .env.local, which may hold a real TMDB key: clear it
// so no test ever calls TMDB. Tests of the TMDB source set a fake key and a fake fetch themselves.
delete process.env.TMDB_READ_ACCESS_TOKEN;
delete process.env.TMDB_API_KEY;
delete process.env.TMDB_API_BASE;
delete process.env.TMDB_REGION;
// The same for the clerk's model: no test may call Gemini or Groq. AI tests pass in a mock model.
delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.AI_PROVIDER;
delete process.env.AI_MODEL;
delete process.env.GROQ_MODEL;
delete process.env.GOOGLE_MODEL;
