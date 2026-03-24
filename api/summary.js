export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda niedozwolona' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Brak userId' });

  // Pobierz nastroje z ostatnich 7 dni
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const moodRes = await fetch(
    `${supabaseUrl}/rest/v1/mood_logs?user_id=eq.${userId}&created_at=gte.${sevenDaysAgo}&order=created_at.asc`,
    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
  );
  const moods = await moodRes.json();

  const moodNames = { 1: 'bardzo źle', 2: 'źle', 3: 'średnio', 4: 'dobrze', 5: 'świetnie' };
  const moodEmojis = { 1: '😔', 2: '😕', 3: '😐', 4: '🙂', 5: '😊' };

  if (!moods || moods.length === 0) {
    return res.status(200).json({ summary: 'Nie mam jeszcze wystarczająco danych z tego tygodnia żeby przygotować podsumowanie. Wróć po kilku dniach! 🌸' });
  }

  const moodList = moods.map(m => {
    const date = new Date(m.created_at).toLocaleDateString('pl-PL', { weekday: 'long' });
    return `${date}: ${moodEmojis[m.mood]} ${moodNames[m.mood]}${m.note ? ` (${m.note})` : ''}`;
  }).join('\n');

  const avg = (moods.reduce((sum, m) => sum + m.mood, 0) / moods.length).toFixed(1);

  const prompt = `Na podstawie poniższych danych o nastroju użytkownika z ostatnich 7 dni, napisz krótkie, ciepłe i szczere podsumowanie tygodnia. Napisz jak bliski przyjaciel — bez terapeutycznego języka. Wspomnij o trendach jeśli je widzisz. Maksymalnie 4-5 zdań.

Dane nastrojów:
${moodList}

Średni nastrój: ${avg}/5`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  const summary = data.content?.[0]?.text || 'Nie udało się wygenerować podsumowania.';

  return res.status(200).json({ summary, moodCount: moods.length, avgMood: avg });
}
