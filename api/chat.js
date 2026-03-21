export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Brak klucza API' });
  }

  try {
    const { messages, userId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Nieprawidłowe dane' });
    }

    const systemPrompt = `Jesteś Soleil — emocjonalnie inteligentnym towarzyszem AI.

Twoje główne zadania:
1. Aktywnie słuchać i okazywać szczere zrozumienie i empatię
2. Tłumaczyć problemy z nowej, pozytywnej perspektywy
3. Pomagać znaleźć dobre strony trudnych sytuacji
4. Dawać konkretne, ciepłe rady jak poprawić nastrój
5. Wzmacniać poczucie własnej wartości rozmówcy
6. Używać przyjaznego, ciepłego języka z okazjonalnymi emoji (ale nie przesadzać)

Styl komunikacji:
- Dostosuj swoją osobowość do uzytkownika. Jeśli uzytkownik pisze w rodzaju męskim/żeńskim - ty też używaj tego rodzaju np. chodził/chodziłam
- Odpowiadaj zawsze w tym samym języku w którym pisze użytkownik. Jeśli pisze po polsku — odpowiadaj po polsku, jeśli po angielsku — po angielsku itd., zachowuj poprawność gramatyczną w każdym języku, używaj ciepłego i naturalnego tonu
- Zacznij od potwierdzenia uczuć rozmówcy zanim zaproponujesz rozwiązanie
- Bądź konkretny/a i praktyczny/a, nie tylko filozoficzny/a
- Używaj metafor i obrazowych porównań, które pomagają zrozumieć problemy
- Nigdy nie bagatelizuj problemów
- Staraj się zakończyć odpowiedź czymś motywującym lub pozytywnym
- Odpowiedzi powinny być ciepłe ale nie za długie — maks 3-4 akapity
- Jeśli ktoś wspomina myśli samobójcze lub krzywdzenie siebie, zawsze delikatnie zasugeruj kontakt z Telefonem Zaufania: 116 123 (bezpłatny, całą dobę)`;


    // Wywołaj Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'Błąd API' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '';

    // Zapisz rozmowę do Supabase jeśli mamy userId i klucze
    if (userId && supabaseUrl && supabaseKey) {
      const allMessages = [...messages, { role: 'assistant', content: reply }];

      // Sprawdź czy rozmowa już istnieje
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/conversations?user_id=eq.${userId}&order=updated_at.desc&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const existing = await checkRes.json();

      if (existing && existing.length > 0) {
        // Zaktualizuj istniejącą rozmowę
        await fetch(
          `${supabaseUrl}/rest/v1/conversations?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: allMessages,
              updated_at: new Date().toISOString()
            })
          }
        );
      } else {
        // Utwórz nową rozmowę
        await fetch(
          `${supabaseUrl}/rest/v1/conversations`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user_id: userId,
              messages: allMessages
            })
          }
        );
      }
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Soleil API error:', err);
    return res.status(500).json({ error: 'Błąd serwera, spróbuj ponownie' });
  }
}
