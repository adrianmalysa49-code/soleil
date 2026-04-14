import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda niedozwolona' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL;

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Brak konfiguracji VAPID' });
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  const { userId, title, body, url } = req.body;

  try {
    // Pobierz subskrypcje
    const query = userId
      ? `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}`
      : `${supabaseUrl}/rest/v1/push_subscriptions`;

    const subRes = await fetch(query, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const subscriptions = await subRes.json();

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ sent: 0 });
    }

    const payload = JSON.stringify({
      title: title || 'Soleil ☀️',
      body: body || 'Hej, jak minął Ci dzień? Jestem tu dla Ciebie.',
      url: url || '/',
      icon: '/logosoleil.png',
      badge: '/logosoleil.png'
    });

    let sent = 0;
    const failed = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subskrypcja wygasła — usuń ją
          failed.push(sub.user_id);
        }
      }
    }

    // Usuń wygasłe subskrypcje
    for (const uid of failed) {
      await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${uid}`, {
        method: 'DELETE',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
    }

    return res.status(200).json({ sent, failed: failed.length });

  } catch (err) {
    console.error('Push send error:', err);
    return res.status(500).json({ error: 'Błąd wysyłania' });
  }
}
