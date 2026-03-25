export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Brak konfiguracji Supabase' });
  }

  // POST — zapisz nastrój
  if (req.method === 'POST') {
    const { userId, mood, note } = req.body;
    if (!userId || !mood) return res.status(400).json({ error: 'Brak danych' });

    // Sprawdź czy użytkownik już dziś zapisał nastrój
    const today = new Date().toISOString().split('T')[0];
    const checkToday = await fetch(
      `${supabaseUrl}/rest/v1/mood_logs?user_id=eq.${userId}&created_at=gte.${today}T00:00:00`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const todayLogs = await checkToday.json();
    if (todayLogs && todayLogs.length > 0) {
      return res.status(200).json({ success: true, skipped: true });
    }

    // Zapisz nastrój
    const response = await fetch(`${supabaseUrl}/rest/v1/mood_logs`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: userId, mood, note: note || null })
    });

    if (!response.ok) return res.status(500).json({ error: 'Błąd zapisu' });

    // Zaktualizuj streak bezpośrednio w Supabase
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const statsRes = await fetch(
      `${supabaseUrl}/rest/v1/user_stats?user_id=eq.${userId}`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const stats = await statsRes.json();

    let newStreak = 1;
    let longestStreak = 1;

    if (stats && stats.length > 0) {
      const current = stats[0];
      longestStreak = current.longest_streak || 1;

      if (current.last_streak_date === today) {
        return res.status(200).json({ success: true, streak: current.streak });
      } else if (current.last_streak_date === yesterday) {
        newStreak = (current.streak || 0) + 1;
        longestStreak = Math.max(newStreak, longestStreak);
      } else {
        newStreak = 1;
      }

      await fetch(
        `${supabaseUrl}/rest/v1/user_stats?user_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            streak: newStreak,
            last_streak_date: today,
            longest_streak: longestStreak,
            updated_at: new Date().toISOString()
          })
        }
      );
    } else {
      await fetch(
        `${supabaseUrl}/rest/v1/user_stats`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId,
            streak: 1,
            last_streak_date: today,
            longest_streak: 1
          })
        }
      );
    }

    return res.status(200).json({ success: true, streak: newStreak });
  }

  // GET — pobierz nastroje z ostatnich 7 dni
  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `${supabaseUrl}/rest/v1/mood_logs?user_id=eq.${userId}&created_at=gte.${sevenDaysAgo}&order=created_at.desc`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );

    const data = await response.json();
    return res.status(200).json({ moods: data });
  }

  return res.status(405).json({ error: 'Metoda niedozwolona' });
}
